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

// Export Grantha
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

        // Fetch ALL commentaries for this grantha
        const allCommentaries = await Commentary.find({ granthaId }).lean();

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

// Import Grantha from JSON file (fixed - properly handles commentary hierarchy)
router.post('/import', upload.single('granthaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse JSON from uploaded file
        const fileContent = req.file.buffer.toString('utf8');
        let importData;
        try {
            importData = JSON.parse(fileContent);
        } catch (parseError) {
            return res.status(400).json({ error: 'Invalid JSON file format' });
        }

        // Validate import data structure
        if (!importData.grantha || !importData.verses) {
            return res.status(400).json({ error: 'Invalid grantha export file structure' });
        }

        const { grantha: granthaData, verses: versesData } = importData;

        // Check if grantha with same title already exists
        const existingGrantha = await Grantha.findOne({
            title: granthaData.title,
            author: granthaData.author
        });

        if (existingGrantha) {
            return res.status(400).json({
                error: 'A grantha with the same title and author already exists. Please delete it first or modify the import file.'
            });
        }

        // Create new grantha
        const newGrantha = new Grantha(granthaData);
        await newGrantha.save();

        let versesCreated = 0;
        let commentariesCreated = 0;

        // Create verses and commentaries
        for (const verseData of versesData) {
            const { commentaries, ...verseInfo } = verseData;

            // Create verse
            const newVerse = new Verse({
                ...verseInfo,
                granthaId: newGrantha._id
            });
            await newVerse.save();
            versesCreated++;

            // Create commentaries for this verse
            if (commentaries && commentaries.length > 0) {
                // Map to track old commentary IDs to new commentary IDs
                const commentaryIdMap = new Map();

                // Sort commentaries by level to create parent commentaries first
                const sortedCommentaries = [...commentaries].sort((a, b) => (a.level || 0) - (b.level || 0));

                for (const commentaryData of sortedCommentaries) {
                    // Determine the correct parent commentary ID
                    let newParentId = null;
                    if (commentaryData.parentCommentaryId) {
                        // Look up the new ID of the parent commentary
                        newParentId = commentaryIdMap.get(commentaryData.parentCommentaryId);
                        if (!newParentId) {
                            console.warn(`Parent commentary not found for: ${commentaryData.commentaryName}, setting parentCommentaryId to null`);
                        }
                    }

                    const newCommentary = new Commentary({
                        granthaId: newGrantha._id,
                        verseId: newVerse._id,
                        commentaryName: commentaryData.commentaryName,
                        commentator: commentaryData.commentator,
                        commentaryText: commentaryData.commentaryText,
                        level: commentaryData.level || 0,
                        parentCommentaryId: newParentId,
                        githubPath: commentaryData.githubPath || null
                    });

                    await newCommentary.save();

                    // Store the mapping from old ID to new ID
                    if (commentaryData._id) {
                        commentaryIdMap.set(commentaryData._id, newCommentary._id);
                    }

                    commentariesCreated++;
                }
            }
        }

        res.status(201).json({
            message: `Grantha imported successfully! Created ${versesCreated} verses and ${commentariesCreated} commentaries.`,
            grantha: newGrantha,
            statistics: {
                versesCreated,
                commentariesCreated
            }
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            error: 'Failed to import grantha: ' + error.message
        });
    }
});

// Create new grantha
router.post('/', async (req, res) => {
    try {
        const { verses, ...granthaData } = req.body;

        // Create grantha
        const grantha = new Grantha(granthaData);
        await grantha.save();

        // Create verses and commentaries if provided
        if (verses && verses.length > 0) {
            for (const verseData of verses) {
                const { commentaries, ...verseInfo } = verseData;

                const verse = new Verse({
                    ...verseInfo,
                    granthaId: grantha._id
                });
                await verse.save();

                // Create commentaries for this verse
                if (commentaries && commentaries.length > 0) {
                    for (const commentaryData of commentaries) {
                        const commentary = new Commentary({
                            ...commentaryData,
                            verseId: verse._id,
                            granthaId: grantha._id
                        });
                        await commentary.save();
                    }
                }
            }
        }

        res.status(201).json(grantha);
    } catch (error) {
        console.error('Error creating grantha:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update grantha
router.put('/:id', async (req, res) => {
    try {
        const { verses, ...granthaData } = req.body;

        const grantha = await Grantha.findByIdAndUpdate(
            req.params.id,
            granthaData,
            { new: true, runValidators: true }
        );

        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        // Update verses if provided
        if (verses && verses.length > 0) {
            // Delete existing verses and commentaries
            const existingVerses = await Verse.find({ granthaId: grantha._id });
            for (const verse of existingVerses) {
                await Commentary.deleteMany({ verseId: verse._id });
            }
            await Verse.deleteMany({ granthaId: grantha._id });

            // Create new verses and commentaries
            for (const verseData of verses) {
                const { commentaries, ...verseInfo } = verseData;

                const verse = new Verse({
                    ...verseInfo,
                    granthaId: grantha._id
                });
                await verse.save();

                if (commentaries && commentaries.length > 0) {
                    for (const commentaryData of commentaries) {
                        const commentary = new Commentary({
                            ...commentaryData,
                            verseId: verse._id,
                            granthaId: grantha._id
                        });
                        await commentary.save();
                    }
                }
            }
        }

        res.json(grantha);
    } catch (error) {
        console.error('Error updating grantha:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete grantha (MongoDB only, keeps GitHub data)
router.delete('/:id', async (req, res) => {
    try {
        const grantha = await Grantha.findById(req.params.id);
        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        console.log(`Deleting grantha from MongoDB: ${grantha.title} (${req.params.id})`);

        // Delete all associated verses and commentaries from MongoDB only
        const verses = await Verse.find({ granthaId: req.params.id });
        console.log(`Found ${verses.length} verses to delete`);

        // Delete all commentaries for all verses
        for (const verse of verses) {
            const commentaryCount = await Commentary.countDocuments({ verseId: verse._id });
            if (commentaryCount > 0) {
                await Commentary.deleteMany({ verseId: verse._id });
                console.log(`  Deleted ${commentaryCount} commentaries for verse ${verse._id}`);
            }
        }

        // Delete all verses
        await Verse.deleteMany({ granthaId: req.params.id });
        console.log(`✓ Deleted ${verses.length} verses`);

        // Delete grantha
        await Grantha.findByIdAndDelete(req.params.id);
        console.log('✓ Deleted grantha from database');

        res.json({
            message: 'Grantha deleted successfully from database (GitHub data preserved)',
            deletedVerses: verses.length
        });
    } catch (error) {
        console.error('Error deleting grantha:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
