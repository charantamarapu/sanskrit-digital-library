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

        const grantha = await Grantha.findById(granthaId).lean();
        if (!grantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        const verses = await Verse.find({ granthaId }).sort({ chapterNumber: 1, verseNumber: 1 }).lean();
        const verseIds = verses.map(v => v._id);
        const allCommentaries = await Commentary.find({ verseId: { $in: verseIds } }).lean();

        console.log(`Exporting: ${verses.length} verses, ${allCommentaries.length} commentaries`);

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

        const importData = JSON.parse(req.file.buffer.toString('utf8'));

        if (!importData.grantha || !importData.verses) {
            return res.status(400).json({ error: 'Invalid import file format' });
        }

        const { _id, createdAt, updatedAt, __v, ...granthaData } = importData.grantha;
        const newGrantha = new Grantha(granthaData);
        await newGrantha.save();

        const verseIdMap = new Map();

        for (const oldVerse of importData.verses) {
            const { _id: oldId, createdAt, updatedAt, __v, ...verseData } = oldVerse;

            const newVerse = new Verse({
                ...verseData,
                granthaId: newGrantha._id
            });
            await newVerse.save();

            verseIdMap.set(oldId, newVerse._id);
        }

        if (importData.commentaries && importData.commentaries.length > 0) {
            const commentaryIdMap = new Map();

            for (const oldCommentary of importData.commentaries) {
                const { _id: oldId, createdAt, updatedAt, __v, ...commentaryData } = oldCommentary;

                const newCommentary = new Commentary({
                    ...commentaryData,
                    granthaId: newGrantha._id,
                    verseId: verseIdMap.get(commentaryData.verseId.toString()),
                    parentCommentaryId: null
                });
                await newCommentary.save();

                commentaryIdMap.set(oldId, newCommentary._id);
            }

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

// Update grantha - DEBUG VERSION with detailed logging
router.put('/:id', async (req, res) => {
    try {
        const oldGrantha = await Grantha.findById(req.params.id);
        if (!oldGrantha) {
            return res.status(404).json({ error: 'Grantha not found' });
        }

        console.log('====== GRANTHA UPDATE DEBUG ======');
        console.log('Old Commentaries:', JSON.stringify(oldGrantha.availableCommentaries, null, 2));
        console.log('New Commentaries:', JSON.stringify(req.body.availableCommentaries, null, 2));

        const oldCommentaries = oldGrantha.availableCommentaries || [];
        const newCommentaries = req.body.availableCommentaries || [];

        // Find name changes by matching IDs
        const nameChanges = [];
        for (let i = 0; i < oldCommentaries.length; i++) {
            const oldComm = oldCommentaries[i];
            const newComm = newCommentaries.find(nc =>
                nc._id && nc._id.toString() === oldComm._id.toString()
            );

            if (newComm && newComm.name !== oldComm.name) {
                console.log(`Found name change: "${oldComm.name}" -> "${newComm.name}"`);
                nameChanges.push({
                    oldName: oldComm.name,
                    newName: newComm.name
                });
            }
        }

        console.log('Total name changes detected:', nameChanges.length);

        // Update the grantha
        const grantha = await Grantha.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        // Update commentaries
        let totalUpdated = 0;
        if (nameChanges.length > 0) {
            for (const change of nameChanges) {
                console.log(`🔄 Updating from "${change.oldName}" to "${change.newName}"`);

                const result = await Commentary.updateMany(
                    {
                        granthaId: req.params.id,
                        commentaryName: change.oldName
                    },
                    {
                        $set: { commentaryName: change.newName }
                    }
                );

                totalUpdated += result.modifiedCount;
                console.log(`✅ Modified ${result.modifiedCount} commentaries`);
            }
        }

        console.log(`Total commentaries updated: ${totalUpdated}`);
        console.log('====== UPDATE COMPLETE ======');

        res.json({
            success: true,
            grantha,
            updatedCommentaries: totalUpdated,
            nameChanges: nameChanges
        });
    } catch (error) {
        console.error('❌ Update error:', error);
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

        const verses = await Verse.find({ granthaId: req.params.id });

        for (const verse of verses) {
            await Commentary.deleteMany({ verseId: verse._id });
        }

        await Verse.deleteMany({ granthaId: req.params.id });
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
