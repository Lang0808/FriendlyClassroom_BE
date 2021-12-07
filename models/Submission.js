const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { ObjectId } = mongoose.Schema.Types;

const Submission = new Schema(
    {
        classroomId: {
            type: ObjectId,
            ref: 'Classroom',
        },
        homeworkId: {
            type: ObjectId,
            ref: 'Homework',
        },
        studentId: {
            type: ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['TO DO', 'DONE', 'OVERDUE'],
        },
        comment: {
            type: String,
        },
        score: {
            type: Number,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Submission', Submission);