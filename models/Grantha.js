const mongoose = require('mongoose');

const commentaryDefinitionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    author: {
        type: String
    },
    order: {
        type: Number,
        default: 0
    }
});

const granthaSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    titleEnglish: {
        type: String
    },
    author: {
        type: String
    },
    authorEnglish: {
        type: String
    },
    description: {
        type: String
    },
    language: {
        type: String,
        default: 'Sanskrit'
    },
    category: {
        type: String,
        enum: ['Veda', 'Upanishad', 'Purana', 'Philosophical', 'Stotra', 'Other'],
        default: 'Other'
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    chapterLabel: {
        type: String,
        default: 'अध्यायः'
    },
    verseLabel: {
        type: String,
        default: 'श्लोकः'
    },
    chapterLabelEnglish: {
        type: String,
        default: 'Chapter'
    },
    verseLabelEnglish: {
        type: String,
        default: 'Verse'
    },
    availableCommentaries: [commentaryDefinitionSchema],
    githubPath: {
        type: String,
        required: false
    },
    totalChapters: {
        type: Number,
        default: 0
    },
    totalVerses: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Grantha', granthaSchema);
