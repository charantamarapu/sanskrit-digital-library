const mongoose = require('mongoose');

const commentarySchema = new mongoose.Schema({
    verseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Verse',
        required: true
    },
    commentaryName: {
        type: String,
        required: true
    },
    commentator: {
        type: String
    },
    commentaryText: {
        type: String,
        required: true  // Now stored directly in MongoDB
    },
    level: {
        type: Number,
        default: 0
    },
    parentCommentaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commentary'
    }
}, { timestamps: true });

commentarySchema.index({ verseId: 1 });
commentarySchema.index({ parentCommentaryId: 1 });

module.exports = mongoose.model('Commentary', commentarySchema);
