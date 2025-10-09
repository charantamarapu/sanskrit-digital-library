const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    granthaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grantha', required: true },
    verseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Verse' },
    commentaryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Commentary' },
    suggestionType: { type: String, enum: ['moolam', 'commentary'], required: true },
    originalText: { type: String, required: true },
    suggestedText: { type: String, required: true },
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedBy: String,
    createdAt: { type: Date, default: Date.now }
});

suggestionSchema.index({ status: 1 });
suggestionSchema.index({ granthaId: 1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
