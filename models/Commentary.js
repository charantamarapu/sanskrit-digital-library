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
        required: false  // Changed from required: true
    },
    githubPath: {
        type: String,
        required: false
    },
    parentCommentaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Commentary',
        default: null
    },
    level: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

commentarySchema.pre('save', async function (next) {
    if (this.isNew) {
        if (this.parentCommentaryId) {
            const parent = await mongoose.model('Commentary').findById(this.parentCommentaryId);
            if (parent) {
                this.level = parent.level + 1;
            }
        } else {
            this.level = 0;
        }
    }
    next();
});

commentarySchema.index({ verseId: 1, commentaryName: 1, level: 1 });
commentarySchema.index({ granthaId: 1 });
commentarySchema.index({ parentCommentaryId: 1 });

module.exports = mongoose.model('Commentary', commentarySchema);
