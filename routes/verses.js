const express = require('express');
const router = express.Router();
const Verse = require('../models/Verse');
const Commentary = require('../models/Commentary');

// Get all verses for a grantha
router.get('/grantha/:granthaId', async (req, res) => {
    try {
        const verses = await Verse.find({ granthaId: req.params.granthaId })
            .lean();

        // Sort manually to handle mixed string/number types
        verses.sort((a, b) => {
            const chapterA = String(a.chapterNumber);
            const chapterB = String(b.chapterNumber);
            const chapterCompare = chapterA.localeCompare(chapterB, undefined, { numeric: true });

            if (chapterCompare !== 0) return chapterCompare;

            const verseA = String(a.verseNumber);
            const verseB = String(b.verseNumber);
            return verseA.localeCompare(verseB, undefined, { numeric: true });
        });

        res.json(verses);
    } catch (error) {
        console.error('Error fetching verses:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single verse by ID
router.get('/:id', async (req, res) => {
    try {
        const verse = await Verse.findById(req.params.id).lean();

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        res.json(verse);
    } catch (error) {
        console.error('Error fetching verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new verse
router.post('/', async (req, res) => {
    try {
        const verse = new Verse(req.body);
        await verse.save();
        res.status(201).json(verse);
    } catch (error) {
        console.error('Error creating verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update verse
router.put('/:id', async (req, res) => {
    try {
        const verse = await Verse.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        res.json(verse);
    } catch (error) {
        console.error('Error updating verse:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete verse
router.delete('/:id', async (req, res) => {
    try {
        const verse = await Verse.findById(req.params.id);

        if (!verse) {
            return res.status(404).json({ error: 'Verse not found' });
        }

        // Delete associated commentaries
        await Commentary.deleteMany({ verseId: req.params.id });
        await Verse.findByIdAndDelete(req.params.id);

        res.json({ message: 'Verse and associated commentaries deleted successfully' });
    } catch (error) {
        console.error('Error deleting verse:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
