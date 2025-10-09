const express = require('express');
const router = express.Router();
const Grantha = require('../models/Grantha');

// Advanced search with EXACT phrase matching
router.get('/advanced', async (req, res) => {
    try {
        const query = req.query.q;

        if (!query || query.length < 2) {
            return res.json({ results: [] });
        }

        // Create EXACT phrase regex - case insensitive but requires exact sequence
        // Escape special regex characters but keep the exact phrase
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(escapedQuery, 'i');

        const results = [];

        // Search in Granthas - EXACT phrase only
        const granthas = await Grantha.find({
            $or: [
                { title: { $regex: searchRegex } },
                { titleEnglish: { $regex: searchRegex } },
                { author: { $regex: searchRegex } },
                { authorEnglish: { $regex: searchRegex } },
                { description: { $regex: searchRegex } }
            ],
            status: 'published'
        }).limit(5);

        granthas.forEach(grantha => {
            results.push({
                type: 'grantha',
                id: grantha._id,
                granthaId: grantha._id,
                title: grantha.title,
                subtitle: grantha.author,
                content: grantha.description
            });
        });

        res.json({ results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;