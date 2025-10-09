const mongoose = require('mongoose');

const verseSchema = new mongoose.Schema({
    granthaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grantha',
        required: true
    },
    chapterNumber: {
        type: mongoose.Schema.Types.Mixed,  // Changed from Number
        required: true
    },
    verseNumber: {
        type: mongoose.Schema.Types.Mixed,  // Changed from Number
        required: true
    },
    verseText: {
        type: String,
        required: false
    },
    githubPath: {
        type: String,
        required: false
    }
}, {
    timestamps: true
});

verseSchema.index({ granthaId: 1, chapterNumber: 1, verseNumber: 1 });

module.exports = mongoose.model('Verse', verseSchema);
