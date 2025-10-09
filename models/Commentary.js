const mongoose = require('mongoose');

const commentarySchema = new mongoose.Schema({
    granthaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grantha',
        required: true
    },
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
        required: true
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
commentarySchema.index({ granthaId: 1 });
commentarySchema.index({ parentCommentaryId: 1 });

module.exports = mongoose.model('Commentary', commentarySchema);
