const express = require('express');
const router = express.Router();
const multer = require('multer');
const Grantha = require('../models/Grantha');
const Verse = require('../models/Verse');
const Commentary = require('../models/Commentary');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/json') {
            cb(null, true);
        } else {
            cb(new Error('Only JSON files are allowed'));
        }
    }
});

// Get all published granthas (with pagination)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const granthas = await Grantha.find({ status: 'published' })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCount = await Grantha.countDocuments({ status: 'published' });
        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            granthas,
            currentPage: page,
            totalPages,
            totalCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single grantha by ID
router.get('/:id', async (req, res) => {
    try {
        const grantha = await Grantha.findById(req.params.id);
        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }
        res.json(grantha);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export Grantha (FIXED - fetches commentaries by verse IDs)
router.get('/:id/export', async (req, res) => {
    try {
        const granthaId = req.params.id;

        // Fetch grantha
        const grantha = await Grantha.findById(granthaId).lean();
        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        // Fetch all verses
        const verses = await Verse.find({ granthaId }).sort({ chapterNumber: 1, verseNumber: 1 }).lean();

        // Get all verse IDs
        const verseIds = verses.map(v => v._id);

        // Fetch ALL commentaries for these verses (FIXED)
        const allCommentaries = await Commentary.find({
            verseId: { $in: verseIds }
        }).lean();

        console.log(`Exporting: ${verses.length} verses, ${allCommentaries.length} commentaries`);

        // Create export data
        const exportData = {
            exportVersion: '1.0',
            exportDate: new Date().toISOString(),
            grantha: {
                title: grantha.title,
                titleEnglish: grantha.titleEnglish,
                author: grantha.author,
                authorEnglish: grantha.authorEnglish,
                description: grantha.description,
                language: grantha.language,
                category: grantha.category,
                status: grantha.status,
                chapterLabel: grantha.chapterLabel,
                verseLabel: grantha.verseLabel,
                chapterLabelEnglish: grantha.chapterLabelEnglish,
                verseLabelEnglish: grantha.verseLabelEnglish,
                availableCommentaries: grantha.availableCommentaries
            },
            verses: verses.map(verse => ({
                _id: verse._id.toString(),
                chapterNumber: verse.chapterNumber,
                verseNumber: verse.verseNumber,
                verseText: verse.verseText
            })),
            commentaries: allCommentaries.map(commentary => ({
                _id: commentary._id.toString(),
                verseId: commentary.verseId.toString(),
                commentaryName: commentary.commentaryName,
                commentator: commentary.commentator,
                commentaryText: commentary.commentaryText,
                level: commentary.level,
                parentCommentaryId: commentary.parentCommentaryId ? commentary.parentCommentaryId.toString() : null
            })),
            statistics: {
                totalVerses: verses.length,
                totalCommentaries: allCommentaries.length,
                chapters: [...new Set(verses.map(v => v.chapterNumber))].length
            }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${grantha.titleEnglish || grantha.title || 'grantha'}_export.json"`);
        res.json(exportData);

    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Failed to export grantha: ' + error.message });
    }
});

// Import Grantha from JSON file
router.post('/import', upload.single('granthaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse JSON from uploaded file
        const importData = JSON.parse(req.file.buffer.toString('utf8'));

        // Validate import data
        if (!importData.grantha || !importData.verses) {
            return res.status(400).json({ error: 'Invalid import file format' });
        }

        // Create grantha (without _id)
        const { _id, createdAt, updatedAt, __v, ...granthaData } = importData.grantha;
        const newGrantha = new Grantha(granthaData);
        await newGrantha.save();

        // Map to store old verse IDs to new verse IDs
        const verseIdMap = new Map();

        // Import verses
        for (const oldVerse of importData.verses) {
            const { _id: oldId, createdAt, updatedAt, __v, ...verseData } = oldVerse;

            const newVerse = new Verse({
                ...verseData,
                granthaId: newGrantha._id
            });
            await newVerse.save();

            // Store mapping of old ID to new ID
            verseIdMap.set(oldId, newVerse._id);
        }

        // Import commentaries (if they exist)
        if (importData.commentaries && importData.commentaries.length > 0) {
            // Map to store old commentary IDs to new commentary IDs
            const commentaryIdMap = new Map();

            // First pass: Create all commentaries (without parent references)
            for (const oldCommentary of importData.commentaries) {
                const { _id: oldId, createdAt, updatedAt, __v, ...commentaryData } = oldCommentary;

                const newCommentary = new Commentary({
                    ...commentaryData,
                    granthaId: newGrantha._id,
                    verseId: verseIdMap.get(commentaryData.verseId.toString()),
                    parentCommentaryId: null // Will fix in second pass
                });
                await newCommentary.save();

                // Store mapping
                commentaryIdMap.set(oldId, newCommentary._id);
            }

            // Second pass: Update parent commentary references
            for (const oldCommentary of importData.commentaries) {
                if (oldCommentary.parentCommentaryId) {
                    const newCommentaryId = commentaryIdMap.get(oldCommentary._id);
                    const newParentId = commentaryIdMap.get(oldCommentary.parentCommentaryId.toString());

                    if (newCommentaryId && newParentId) {
                        await Commentary.findByIdAndUpdate(newCommentaryId, {
                            parentCommentaryId: newParentId
                        });
                    }
                }
            }
        }

        res.json({
            message: `Successfully imported ${importData.verses.length} verses${importData.commentaries ? ` and ${importData.commentaries.length} commentaries` : ''}`,
            granthaId: newGrantha._id
        });

    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            error: 'Failed to import grantha',
            details: error.message
        });
    }
});

// Create new grantha
router.post('/', async (req, res) => {
    try {
        const grantha = new Grantha(req.body);
        await grantha.save();
        res.status(201).json(grantha);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update grantha
router.put('/:id', async (req, res) => {
    try {
        const grantha = await Grantha.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        res.json(grantha);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update grantha (ENHANCED - also updates commentary names)
router.put('/:id', async (req, res) => {
    try {
        const oldGrantha = await Grantha.findById(req.params.id);
        if (!oldGrantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        // Check if availableCommentaries changed
        const oldCommentaries = oldGrantha.availableCommentaries || [];
        const newCommentaries = req.body.availableCommentaries || [];

        // Create a map of old names to new names
        const nameChanges = new Map();
        oldCommentaries.forEach(oldComm => {
            const newComm = newCommentaries.find(nc => nc._id && nc._id.toString() === oldComm._id.toString());
            if (newComm && newComm.name !== oldComm.name) {
                nameChanges.set(oldComm.name, newComm.name);
            }
        });

        // Update the grantha
        const grantha = await Grantha.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Update all Commentary documents with the old names
        if (nameChanges.size > 0) {
            console.log('Updating commentary names:', Array.from(nameChanges.entries()));

            for (const [oldName, newName] of nameChanges.entries()) {
                const result = await Commentary.updateMany(
                    {
                        granthaId: req.params.id,
                        commentaryName: oldName
                    },
                    {
                        $set: { commentaryName: newName }
                    }
                );
                console.log(`Updated ${result.modifiedCount} commentaries from "${oldName}" to "${newName}"`);
            }
        }

        res.json({
            grantha,
            updatedCommentaries: nameChanges.size > 0 ? Array.from(nameChanges.entries()) : []
        });
    } catch (error) {
        console.error('Update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete grantha
router.delete('/:id', async (req, res) => {
    try {
        const grantha = await Grantha.findById(req.params.id);
        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        // Delete all associated verses
        const verses = await Verse.find({ granthaId: req.params.id });

        // Delete all commentaries for all verses
        for (const verse of verses) {
            await Commentary.deleteMany({ verseId: verse._id });
        }

        // Delete all verses
        await Verse.deleteMany({ granthaId: req.params.id });

        // Delete grantha
        await Grantha.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Grantha deleted successfully',
            deletedVerses: verses.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
