const Submission = require('../models/Submission');
const firebase = require('../firebase');
const Homework = require('../models/Homework');

const isUserCanSeeSubmissionMetadataOfHomework = async(userId, homeworkId) => {
    const homework = await Homework.findOne({ _id: homeworkId }, "classroomId")
        .populate({
            path: "classroomId",
            select: "teacherId"
        })
    if (userId != homework.classroomId.teacherId) {
        return false
    }
    return true
}

const isUserCanAddScoreToSubmission = async(userId, homeworkId, studentId) => {
    const homework = await Homework.findOne({ _id: homeworkId }, "classroomId")
        .populate({
            path: "classroomId",
            select: "teacherId"
        })
    console.log(homework)
    if (userId != homework.classroomId.teacherId) {
        return false
    }
    return true
}

const isUserCanSeeSubmission = async(userId, homeworkId, studentId) => {
    if (userId === studentId) return true
    const homework = await Homework.findOne({ _id: homeworkId }, "classroomId")
        .populate({
            path: "classroomId",
            select: "teacherId"
        })
    console.log(homework)
    if (userId != homework.classroomId.teacherId) {
        return false
    }
    return true
}

getSignedUrlSubmission = async(homeworkId, filename) => {
    const destinationFirebase = `submission/${homeworkId}/${filename}`;
    const config = {
        action: 'read',
        expires: '08-08-2025',
    };
    const url = await firebase.bucket.file(destinationFirebase).getSignedUrl(config);
    return url;
};

class SubmissionController {
    submitSubmission = (req, res) => {
        try {
            const studentId = req.userId;
            const homeworkId = req.body.homeworkId;
            const file = req.file;

            if (!file) {
                throw new Error('Not submission');
            }

            // newFilename = {studentId}.{extension of file}
            const newFilename = `${studentId}.${file.filename.split('.')[1]}`;
            var optionsFirebase = {
                destination: `submission/${homeworkId}/${newFilename}`,
            };

            // Only update default submission, not create new submission
            firebase.bucket.upload(file.path, optionsFirebase, async function(err, item) {
                const markDone = true;
                const urls = await getSignedUrlSubmission(homeworkId, newFilename)
                const attachedFiles = [urls[0]];
                await Submission.updateOne({ homeworkId: homeworkId, studentId: studentId }, { $set: { attachedFiles: attachedFiles, markDone: markDone } });
                return res.status(200).json({ success: true, message: 'Nộp thành công' });
            });
        } catch (err) {
            if (err.message == 'Not submission') {
                return res.status(400).json({ success: false, message: 'File bài làm của bạn đâu :(' });
            }
        }
    };

    getSubmission = async(req, res) => {
        try {
            const userId = req.userId; // user who want to see submission
            const homeworkId = req.body.homeworkId;
            const studentId = req.body.studentId; // the owner of submission user want to see

            // only teacher and that student can see his submission
            const isValid = isUserCanSeeSubmission(userId, homeworkId, studentId)
            if (!isValid) {
                throw new Error("Rights")
            }

            // Maybe we dont need this because every student will have default submission
            const submission = await Submission.findOne({ homeworkId: homeworkId, studentId: studentId });
            console.log(submission)
            if (!submission) {
                throw new Error('Not submit');
            }

            return res.status(200).json({ success: true, submission });

        } catch (err) {
            if (err.message == 'Rights') {
                return res.status(400).json({ success: false, message: 'Bạn không có quyền xem bài làm này' });
            } else if (err.message == 'Not submit') {
                return res.status(400).json({ success: false, message: 'Không tìm thấy bài nộp của bạn' });
            }
        }
    };

    addCommentAndScore = async(req, res) => {
        try {
            const score = req.body.score;
            const comment = req.body.comment;
            const studentId = req.body.studentId;
            const homeworkId = req.body.homeworkId;
            const userId = req.userId

            const isValid = await isUserCanAddScoreToSubmission(userId, homeworkId, studentId)
            if (!isValid) {
                throw new Error("Rights")
            }

            await Submission.findOneAndUpdate({ homeworkId: homeworkId, studentId: studentId }, { $set: { score: score, comment: comment } });
            return res.status(200).json({ success: true, message: 'Đã thêm comment và điểm' });
        } catch (err) {
            if (err.message === "Rights") {
                return res.status(400).json({ success: false, message: 'Bạn không có quyền thêm điểm cho bài nộp này' });
            } else {
                console.log(err);
                return res.status(400).json({ success: false, message: 'Lỗi rồi :(' });
            }
        }
    };

    getAllSubmissionMetadataOfHomework = async(req, res) => {
        try {
            const homeworkId = req.body.homeworkId;
            const userId = req.userId
            const isValid = await isUserCanSeeSubmissionMetadataOfHomework(userId, homeworkId)
            if (!isValid) {
                throw new Error("Rights")
            }
            const result = await Submission.find({ homeworkId: homeworkId }, 'studentId markDone score').populate({
                path: 'studentId',
                select: 'fullName username',
            });
            return res.status(200).json(result);
        } catch (err) {
            if (err.message === "Rights") {
                return res.status(400).json({ success: false, message: "Bạn không có quyền truy cập phần này" })
            } else {
                return res.status(400).json({ success: false, message: 'Lỗi rồi :(' })
            }
        }
    };
}

module.exports = new SubmissionController();