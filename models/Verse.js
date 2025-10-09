const mongoose = require('mongoose');

const verseSchema = new mongoose.Schema({
    granthaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grantha',
        required: true
    },
    chapterNumber: {
        type: Number,
        required: true
    },
    verseNumber: {
        type: Number,
        required: true
    },
    verseText: {
        type: String,
        required: false  // Changed from required: true
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
