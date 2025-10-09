const express = require('express');
const router = express.Router();
const Commentary = require('../models/Commentary');
const Verse = require('../models/Verse');
const Grantha = require('../models/Grantha');

// Get all commentaries for a verse with hierarchy
router.get('/verse/:verseId', async (req, res) => {
    try {
        const allCommentaries = await Commentary.find({ verseId: req.params.verseId }).lean();

        if (allCommentaries.length === 0) {
            return res.json([]);
        }

        const grantha = await Grantha.findById(allCommentaries[0].granthaId);

        const buildHierarchy = (parentId = null) => {
            const children = allCommentaries.filter(c => {
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
            .sort({ level: 1, createdAt: 1 })
            .lean();

        res.json(commentaries);
    } catch (error) {
        console.error('Error fetching commentaries:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single commentary by ID
router.get('/:id', async (req, res) => {
    try {
        const commentary = await Commentary.findById(req.params.id)
            .populate('parentCommentaryId')
            .lean();

        if (!commentary) {
            return res.status(404).json({ error: 'Commentary not found' });
        }

        res.json(commentary);
    } catch (error) {
        console.error('Error fetching commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new commentary
router.post('/', async (req, res) => {
    try {
        const commentaryData = req.body;

        // Set level based on parent
        if (commentaryData.parentCommentaryId) {
            const parent = await Commentary.findById(commentaryData.parentCommentaryId);
            commentaryData.level = parent ? parent.level + 1 : 0;
        } else {
            commentaryData.level = 0;
        }

        const commentary = new Commentary(commentaryData);
        await commentary.save();

        res.status(201).json(commentary);
    } catch (error) {
        console.error('Error creating commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update commentary
router.put('/:id', async (req, res) => {
    try {
        const commentaryData = req.body;

        // Set level based on parent
        if (commentaryData.parentCommentaryId) {
            const parent = await Commentary.findById(commentaryData.parentCommentaryId);
            commentaryData.level = parent ? parent.level + 1 : 0;
        } else {
            commentaryData.level = 0;
        }

        const commentary = await Commentary.findByIdAndUpdate(
            req.params.id,
            commentaryData,
            { new: true, runValidators: true }
        );

        if (!commentary) {
            return res.status(404).json({ error: 'Commentary not found' });
        }

        res.json(commentary);
    } catch (error) {
        console.error('Error updating commentary:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete commentary and all its sub-commentaries recursively
router.delete('/:id', async (req, res) => {
    try {
        const deleteRecursive = async (commentaryId) => {
            // Find all child commentaries
            const children = await Commentary.find({ parentCommentaryId: commentaryId });

            // Recursively delete children first
            for (const child of children) {
                await deleteRecursive(child._id);
            }

            // Delete the commentary itself
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
