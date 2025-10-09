const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const Commentary = require('../models/Commentary');
const Grantha = require('../models/Grantha');
const Verse = require('../models/Verse');

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/charantamarapu/sanskrit-library-data/main';
const GITHUB_OWNER = 'charantamarapu';
const GITHUB_REPO = 'sanskrit-library-data';

// Initialize Octokit
let octokit;
const getOctokit = async () => {
    if (!octokit) {
        const { Octokit } = await import('@octokit/rest');
        octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });
    }
    return octokit;
};

// Helper functions
const extractContent = (markdown) => {
    if (!markdown) return '';
    const parts = markdown.split('---');
    if (parts.length >= 3) {
        return parts.slice(2).join('---').trim();
    }
    return markdown;
};

const sanitizeFolderName = (name) => {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
};

const encodeGithubPath = (basePath, ...segments) => {
    const encodedSegments = segments.map(seg => encodeURIComponent(seg));
    return `${basePath}/${encodedSegments.join('/')}`;
};

// Fetch content from GitHub API (no caching, instant updates)
const fetchContentFromGitHub = async (githubPath) => {
    try {
        const octokit = await getOctokit();

        // Extract file path from raw URL
        const urlParts = githubPath.replace(GITHUB_BASE_URL + '/', '').split('/');
        const filePath = urlParts.map(part => decodeURIComponent(part)).join('/');

        const { data } = await octokit.repos.getContent({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: filePath,
            ref: 'main'
        });

        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf8');
        return extractContent(content);
    } catch (error) {
        console.error('Error fetching from GitHub API:', error.message);
        throw error;
    }
};

// Create or update commentary file in GitHub using API
const createOrUpdateCommentaryFile = async (commentary, commentaryText) => {
    const verse = await Verse.findById(commentary.verseId);
    if (!verse) throw new Error('Verse not found');

    const octokit = await getOctokit();
    const sanitizedName = sanitizeFolderName(commentary.commentaryName);
    const filePath = `granthas/${commentary.granthaId}/commentaries/${sanitizedName}/chapter-${verse.chapterNumber}/verse-${verse.verseNumber}.md`;

    const frontmatter = `---
commentaryId: "${commentary._id}"
verseId: "${commentary.verseId}"
granthaId: "${commentary.granthaId}"
commentaryName: "${commentary.commentaryName}"
commentator: "${commentary.commentator || ''}"
level: ${commentary.level}
parentCommentaryId: ${commentary.parentCommentaryId ? `"${commentary.parentCommentaryId}"` : 'null'}
---

${commentaryText}
`;

    const content = Buffer.from(frontmatter).toString('base64');

    try {
        let sha;
        try {
            const { data } = await octokit.repos.getContent({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: filePath,
            });
            sha = data.sha;
        } catch (error) {
            sha = undefined;
        }

        await octokit.repos.createOrUpdateFileContents({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            path: filePath,
            message: sha
                ? `Update commentary ${commentary.commentaryName} for verse ${verse.chapterNumber}.${verse.verseNumber}`
                : `Add commentary ${commentary.commentaryName} for verse ${verse.chapterNumber}.${verse.verseNumber}`,
            content: content,
            sha: sha,
            branch: 'main'
        });

        return encodeGithubPath(
            GITHUB_BASE_URL,
            'granthas',
            commentary.granthaId.toString(),
            'commentaries',
            sanitizedName,
            `chapter-${verse.chapterNumber}`,
            `verse-${verse.verseNumber}.md`
        );
    } catch (error) {
        console.error('Error creating/updating commentary file in GitHub:', error);
        throw error;
    }
};

// Fetch commentary content (using GitHub API - instant updates)
const fetchCommentaryContent = async (commentary) => {
    if (!commentary.githubPath) {
        return {
            ...commentary.toObject(),
            commentaryText: commentary.commentaryText || ''
        };
    }

    try {
        const content = await fetchContentFromGitHub(commentary.githubPath);
        return {
            ...commentary.toObject(),
            commentaryText: content
        };
    } catch (error) {
        console.error(`Error fetching commentary ${commentary._id}:`, error.message);
        return {
            ...commentary.toObject(),
            commentaryText: 'Error loading content'
        };
    }
};

// Get all commentaries for a verse with hierarchy
router.get('/verse/:verseId', async (req, res) => {
    try {
        const allCommentaries = await Commentary.find({ verseId: req.params.verseId });

        if (allCommentaries.length === 0) {
            return res.json([]);
        }

        const commentariesWithContent = await Promise.all(
            allCommentaries.map(c => fetchCommentaryContent(c))
        );

        const grantha = await Grantha.findById(allCommentaries[0].granthaId);

        const buildHierarchy = (parentId = null) => {
            const children = commentariesWithContent.filter(c => {
                if (parentId === null) {
                    return !c.parentCommentaryId || c.parentCommentaryId === null;
                }
                return c.parentCommentaryId && c.parentCommentaryId.toString() === parentId.toString();
            });

            if (grantha && grantha.availableCommentaries) {
                children.sort((a, b) => {
                    const orderA = grantha.availableCommentaries.find(gc => gc.name === a.commentaryName)?.order ?? 999;
                    const orderB = grantha.availableCommentaries.find(gc => gc.name === b.commentaryName)?.order ?? 999;
                    return orderA - orderB;
                });
            }

            return children.map(c => {
                const commentaryObj = { ...c };
                const subCommentaries = buildHierarchy(c._id.toString());
                if (subCommentaries.length > 0) {
                    commentaryObj.subCommentaries = subCommentaries;
                }
                return commentaryObj;
            });
        };

        const hierarchicalCommentaries = buildHierarchy(null);
        res.json(hierarchicalCommentaries);
    } catch (error) {
        console.error('Error fetching commentaries:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all commentaries for a grantha - FLAT LIST
router.get('/grantha/:granthaId', async (req, res) => {
    try {
        const commentaries = await Commentary.find({ granthaId: req.params.granthaId })
            .populate('verseId')
            .sort({ level: 1, createdAt: 1 });

        const commentariesWithContent = await Promise.all(
            commentaries.map(c => fetchCommentaryContent(c))
        );

        res.json(commentariesWithContent);
    } catch (error) {
        console.error('Error fetching commentaries:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single commentary by ID
router.get('/:id', async (req, res) => {
    try {
        const commentary = await Commentary.findById(req.params.id)
            .populate('parentCommentaryId');

        if (!commentary) {
            return res.status(404).json({ error: 'Commentary not found' });
        }

        const commentaryWithContent = await fetchCommentaryContent(commentary);
        res.json(commentaryWithContent);
    } catch (error) {
        console.error('Error fetching commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new commentary
router.post('/', async (req, res) => {
    try {
        const { commentaryText, ...commentaryData } = req.body;

        if (commentaryData.parentCommentaryId) {
            const parent = await Commentary.findById(commentaryData.parentCommentaryId);
            commentaryData.level = parent ? parent.level + 1 : 0;
        } else {
            commentaryData.level = 0;
        }

        const commentary = new Commentary(commentaryData);
        const githubPath = await createOrUpdateCommentaryFile(commentary, commentaryText);

        commentary.githubPath = githubPath;
        await commentary.save();

        res.status(201).json({
            ...commentary.toObject(),
            commentaryText: commentaryText
        });
    } catch (error) {
        console.error('Error creating commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update commentary
router.put('/:id', async (req, res) => {
    try {
        const { commentaryText, ...commentaryData } = req.body;

        const commentary = await Commentary.findById(req.params.id);
        if (!commentary) {
            return res.status(404).json({ error: 'Commentary not found' });
        }

        if (commentaryData.parentCommentaryId) {
            const parent = await Commentary.findById(commentaryData.parentCommentaryId);
            commentaryData.level = parent ? parent.level + 1 : 0;
        } else {
            commentaryData.level = 0;
        }

        Object.assign(commentary, commentaryData);

        if (commentaryText !== undefined) {
            const githubPath = await createOrUpdateCommentaryFile(commentary, commentaryText);
            commentary.githubPath = githubPath;
        }

        await commentary.save();

        res.json({
            ...commentary.toObject(),
            commentaryText: commentaryText
        });
    } catch (error) {
        console.error('Error updating commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete commentary and all its sub-commentaries recursively
router.delete('/:id', async (req, res) => {
    try {
        const deleteRecursive = async (commentaryId) => {
            const commentary = await Commentary.findById(commentaryId).populate('verseId');

            if (commentary && commentary.verseId) {
                try {
                    const octokit = await getOctokit();
                    const sanitizedName = sanitizeFolderName(commentary.commentaryName);
                    const filePath = `granthas/${commentary.granthaId}/commentaries/${sanitizedName}/chapter-${commentary.verseId.chapterNumber}/verse-${commentary.verseId.verseNumber}.md`;

                    const { data } = await octokit.repos.getContent({
                        owner: GITHUB_OWNER,
                        repo: GITHUB_REPO,
                        path: filePath,
                    });

                    await octokit.repos.deleteFile({
                        owner: GITHUB_OWNER,
                        repo: GITHUB_REPO,
                        path: filePath,
                        message: `Delete commentary ${commentary.commentaryName} for verse ${commentary.verseId.chapterNumber}.${commentary.verseId.verseNumber}`,
                        sha: data.sha,
                        branch: 'main'
                    });
                } catch (error) {
                    console.error('Error deleting commentary file from GitHub:', error.message);
                }
            }

            const children = await Commentary.find({ parentCommentaryId: commentaryId });
            for (const child of children) {
                await deleteRecursive(child._id);
            }

            await Commentary.findByIdAndDelete(commentaryId);
        };

        await deleteRecursive(req.params.id);
        res.json({ message: 'Commentary and all sub-commentaries deleted successfully' });
    } catch (error) {
        console.error('Error deleting commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
