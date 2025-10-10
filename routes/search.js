const express = require('express');
const router = express.Router();
const Grantha = require('../models/Grantha');
const Verse = require('../models/Verse');
const Commentary = require('../models/Commentary');

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

        // Search in Verses - EXACT phrase only
        const verses = await Verse.find({
            $or: [
                { verseText: { $regex: searchRegex } },
                { meaning: { $regex: searchRegex } }
            ]
        }).populate('granthaId').limit(10);

        verses.forEach(verse => {
            if (verse.granthaId) {
                results.push({
                    type: 'verse',
                    id: verse._id,
                    granthaId: verse.granthaId._id,
                    verseId: verse._id,
                    title: verse.granthaId.title,
                    subtitle: `Chapter ${verse.chapterNumber}, Verse ${verse.verseNumber}`,
                    content: verse.verseText,
                    chapterNumber: verse.chapterNumber,
                    verseNumber: verse.verseNumber
                });
            }
        });

        // Search in Commentaries - EXACT phrase only
        const commentaries = await Commentary.find({
            $or: [
                { commentaryText: { $regex: searchRegex } },
                { commentaryName: { $regex: searchRegex } },
                { commentator: { $regex: searchRegex } }
            ]
        })
            .populate({
                path: 'verseId',
                populate: { path: 'granthaId' }
            })
            .populate('granthaId')
            .limit(10);

        commentaries.forEach(commentary => {
            const granthaId = commentary.granthaId?._id || commentary.verseId?.granthaId?._id;
            const granthaTitle = commentary.granthaId?.title || commentary.verseId?.granthaId?.title;

            if (commentary.verseId && granthaId) {
                results.push({
                    type: 'commentary',
                    id: commentary._id,
                    granthaId: granthaId,
                    verseId: commentary.verseId._id,
                    commentaryId: commentary._id,
                    title: granthaTitle,
                    subtitle: `${commentary.commentaryName || commentary.commentator || 'Commentary'} - Ch ${commentary.verseId.chapterNumber}, V ${commentary.verseId.verseNumber}`,
                    content: commentary.commentaryText,
                    chapterNumber: commentary.verseId.chapterNumber,
                    verseNumber: commentary.verseId.verseNumber,
                    commentaryName: commentary.commentaryName,
                    commentator: commentary.commentator
                });
            }
        });

        // Sort results: granthas first, then verses, then commentaries
        const sortedResults = [
            ...results.filter(r => r.type === 'grantha'),
            ...results.filter(r => r.type === 'verse'),
            ...results.filter(r => r.type === 'commentary')
        ];

        res.json({ results: sortedResults });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
