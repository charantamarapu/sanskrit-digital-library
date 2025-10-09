const express = require('express');
const router = express.Router();
const Suggestion = require('../models/Suggestion');

// Submit a suggestion
router.post('/', async (req, res) => {
    try {
        console.log('Received suggestion data:', req.body); // Debug log

        const { granthaId, verseId, commentaryId, suggestionType, originalText, suggestedText, reason, submittedBy } = req.body;

        // Validate required fields
        if (!granthaId || !verseId || !suggestionType || !originalText || !suggestedText) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['granthaId', 'verseId', 'suggestionType', 'originalText', 'suggestedText']
            });
        }

        const suggestion = new Suggestion({
            granthaId,
            verseId,
            commentaryId: commentaryId || undefined,
            suggestionType,
            originalText,
            suggestedText,
            reason: reason || '',
            submittedBy: submittedBy || 'Anonymous'
        });

        await suggestion.save();
        console.log('Suggestion saved successfully:', suggestion._id);

        res.status(201).json({
            success: true,
            message: 'Suggestion submitted successfully',
            suggestion
        });
    } catch (error) {
        console.error('Error saving suggestion:', error);
        res.status(500).json({
            error: 'Failed to submit suggestion',
            details: error.message
        });
    }
});

// Get all pending suggestions (admin only)
router.get('/pending', async (req, res) => {
    try {
        const suggestions = await Suggestion.find({ status: 'pending' })
            .populate('granthaId')
            .populate('verseId')
            .populate('commentaryId')
            .sort({ createdAt: -1 });
        res.json(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Approve suggestion (admin only)
router.put('/:id/approve', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByIdAndUpdate(
            req.params.id,
            { status: 'approved' },
            { new: true }
        );
        if (!suggestion) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        res.json(suggestion);
    } catch (error) {
        console.error('Error approving suggestion:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reject suggestion (admin only)
router.put('/:id/reject', async (req, res) => {
    try {
        const suggestion = await Suggestion.findByIdAndUpdate(
            req.params.id,
            { status: 'rejected' },
            { new: true }
        );
        if (!suggestion) {
            return res.status(404).json({ error: 'Suggestion not found' });
        }
        res.json(suggestion);
    } catch (error) {
        console.error('Error rejecting suggestion:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
