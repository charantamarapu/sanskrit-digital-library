const express = require('express');
const router = express.Router();
const axios = require('axios');
const { Octokit } = require('@octokit/rest');
const Verse = require('../models/Verse');
const Commentary = require('../models/Commentary');

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
        const filePath = decodeURIComponent(urlParts.join('/'));

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

// Create or update verse file in GitHub using API
const createOrUpdateVerseFile = async (verse, verseText) => {
    const octokit = await getOctokit();
    const filePath = `granthas/${verse.granthaId}/verses/chapter-${verse.chapterNumber}/verse-${verse.verseNumber}.md`;

    const frontmatter = `---
verseId: "${verse._id}"
granthaId: "${verse.granthaId}"
chapterNumber: ${verse.chapterNumber}
verseNumber: ${verse.verseNumber}
---

${verseText}
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
                ? `Update verse ${verse.chapterNumber}.${verse.verseNumber}`
                : `Add verse ${verse.chapterNumber}.${verse.verseNumber}`,
            content: content,
            sha: sha,
            branch: 'main'
        });

        return encodeGithubPath(
            GITHUB_BASE_URL,
            'granthas',
            verse.granthaId.toString(),
            'verses',
            `chapter-${verse.chapterNumber}`,
            `verse-${verse.verseNumber}.md`
        );
    } catch (error) {
        console.error('Error creating/updating file in GitHub:', error);
        throw error;
    }
};

// Get all verses for a grantha (using GitHub API - instant updates)
router.get('/grantha/:granthaId', async (req, res) => {
    try {
        const verses = await Verse.find({ granthaId: req.params.granthaId })
            .lean(); // Returns plain objects, not Mongoose documents

        // Sort manually to handle mixed string/number types
        verses.sort((a, b) => {
            // Compare chapters
            const chapterA = String(a.chapterNumber);
            const chapterB = String(b.chapterNumber);
            const chapterCompare = chapterA.localeCompare(chapterB, undefined, { numeric: true });

            if (chapterCompare !== 0) return chapterCompare;

            // If same chapter, compare verses
            const verseA = String(a.verseNumber);
            const verseB = String(b.verseNumber);
            return verseA.localeCompare(verseB, undefined, { numeric: true });
        });

        const versesWithContent = await Promise.all(
            verses.map(async (verse) => {
                try {
                    if (verse.githubPath) {
                        const content = await fetchContentFromGitHub(verse.githubPath);
                        return {
                            ...verse, // Already plain object from .lean()
                            verseText: content
                        };
                    } else {
                        return {
                            ...verse, // Already plain object from .lean()
                            verseText: verse.verseText || ''
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching verse ${verse._id}:`, error.message);
                    return {
                        ...verse, // Already plain object from .lean()
                        verseText: 'Error loading content'
                    };
                }
            })
        );

        res.json(versesWithContent);
    } catch (error) {
        console.error('Error fetching verses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single verse by ID (using GitHub API - instant updates)
router.get('/:id', async (req, res) => {
    try {
        const verse = await Verse.findById(req.params.id).lean(); // Added .lean()

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        if (verse.githubPath) {
            try {
                const content = await fetchContentFromGitHub(verse.githubPath);
                res.json({
                    ...verse, // Already plain object from .lean()
                    verseText: content
                });
            } catch (error) {
                console.error('Error fetching from GitHub:', error.message);
                res.json({
                    ...verse, // Already plain object from .lean()
                    verseText: 'Error loading content'
                });
            }
        } else {
            res.json({
                ...verse, // Already plain object from .lean()
                verseText: verse.verseText || ''
            });
        }
    } catch (error) {
        console.error('Error fetching verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new verse
router.post('/', async (req, res) => {
    try {
        const { verseText, ...verseData } = req.body;

        const verse = new Verse(verseData);
        const githubPath = await createOrUpdateVerseFile(verse, verseText);

        verse.githubPath = githubPath;

        await verse.save();

        res.status(201).json({
            ...verse.toObject(), // NOT using .lean() here, so .toObject() is correct
            verseText: verseText
        });
    } catch (error) {
        console.error('Error creating verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update verse
router.put('/:id', async (req, res) => {
    try {
        const { verseText, ...verseData } = req.body;

        const verse = await Verse.findById(req.params.id); // NOT using .lean() for update

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        Object.assign(verse, verseData);

        if (verseText !== undefined) {
            const githubPath = await createOrUpdateVerseFile(verse, verseText);
            verse.githubPath = githubPath;
        }

        await verse.save();

        res.json({
            ...verse.toObject(), // NOT using .lean(), so .toObject() is correct
            verseText: verseText
        });
    } catch (error) {
        console.error('Error updating verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete verse
router.delete('/:id', async (req, res) => {
    try {
        const verse = await Verse.findById(req.params.id); // NOT using .lean() for delete

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        try {
            const octokit = await getOctokit();
            const filePath = `granthas/${verse.granthaId}/verses/chapter-${verse.chapterNumber}/verse-${verse.verseNumber}.md`;

            const { data } = await octokit.repos.getContent({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: filePath,
            });

            await octokit.repos.deleteFile({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                path: filePath,
                message: `Delete verse ${verse.chapterNumber}.${verse.verseNumber}`,
                sha: data.sha,
                branch: 'main'
            });
        } catch (error) {
            console.error('Error deleting verse file from GitHub:', error.message);
        }

        await Commentary.deleteMany({ verseId: req.params.id });
        await Verse.findByIdAndDelete(req.params.id);

        res.json({ message: 'Verse and associated commentaries deleted successfully' });
    } catch (error) {
        console.error('Error deleting verse:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
