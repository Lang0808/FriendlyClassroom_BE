const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Classroom = require('../models/Classroom');
const Submission = require('../models/Submission')
const firebase = require('../firebase');

const createDefaultSubmissionForEveryHomeworkInClass = async(code, studentId) => {
    const result = await Classroom.findOne({ code: code }, "topicHomework")
    const markDone = false
    const attachedFiles = []
    for (let i = 0; i < result.topicHomework.length; i++) {
        const topic = result.topicHomework[i];
        for (let j = 0; j < topic.homeworks.length; j++) {
            const homeworkId = topic.homeworks[j];
            const newSubmission = new Submission({
                homeworkId,
                studentId,
                markDone,
                attachedFiles
            });
            await newSubmission.save();
        }
    }
};

const convertToArray = (topicHomework) => {
    var res = []
    const n = topicHomework.length
    for (let i = 0; i < n; i++) {
        res = res.concat(topicHomework[i].homeworks)
    }
    return res
}

const deleteSubmissionsOfStudentInClass = async(studentId, classroomId) => {
    const result = await Classroom.findOne({ _id: classroomId }, "topicHomework")
    console.log(result.topicHomework)
    const homeworks = convertToArray(result.topicHomework)
    console.log(homeworks)
    await Submission.deleteMany({ studentId: studentId, homeworkId: { $in: homeworks } })
        // submission/${homeworkId}/${studentId}/${file.filename}
    for (let i = 0; i < homeworks.length; i++) {
        await firebase.bucket.deleteFiles({
            prefix: `submission/${homeworks[i]}/${studentId}`
        })
    }
}

class ClassroomController {
    get = async(req, res) => {
        try {
            const classroom = await Classroom.findById(
                req.params.classroomId,
                'name code description listPost teacherId listStudent numberOfMember topicDocument.topic topicHomework.topic'
            );
            res.json({ success: true, classroom });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };

    create = async(req, res) => {
        const { name, description } = req.body;
        try {
            // check if user is already teacher of another classroom which has the same name

            let checkDuplicateNameClassroom = await Classroom.findOne({
                name,
                teacherId: req.userId,
            });

            if (checkDuplicateNameClassroom) {
                throw new Error('T??n l???p h???c b??? tr??ng');
            }

            let code = Math.random().toString(36).substring(2, 8);
            // check code unique
            while (await Classroom.findOne({ code: code })) {
                code = Math.random().toString(36).substring(2, 8);
            }

            var numberOfMember = 1;
            const topicDocument = [];
            const topicHomework = [];
            const newClassroom = new Classroom({
                name,
                code,
                description,
                teacherId: req.userId,
                numberOfMember,
                topicDocument,
                topicHomework,
            });
            const result = await newClassroom.save();
            res.json({
                success: true,
                message: 'T???o l???p h???c th??nh c??ng',
                classroom: newClassroom,
            });

            // Add classroom id to classTeacher
            await User.findOneAndUpdate({ _id: req.userId }, { $push: { classTeacher: result._id } });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };
    // @route PUT api/posts
    // @desc Update post
    // @access Private
    update = async(req, res) => {
        const { name, description } = req.body;

        try {
            if (name) {
                // check if user is already teacher of another classroom which has the same name

                let checkDuplicateNameClassroom = await Classroom.findOne({
                    name,
                    teacherId: req.userId,
                });

                if (
                    checkDuplicateNameClassroom &&
                    checkDuplicateNameClassroom._id != req.params.classroomId
                ) {
                    throw new Error('T??n l???p h???c b??? tr??ng');
                }
            }

            const classroomUpdateCondition = {
                _id: req.params.classroomId,
                teacherId: req.userId,
            };

            let updatedClassroom = await Classroom.findOneAndUpdate(
                classroomUpdateCondition, {
                    name,
                    description,
                }, { new: true }
            );

            // User not authorized to update classroom or classroom not found
            if (!updatedClassroom) {
                throw new Error(
                    'B???n kh??ng c?? quy???n ch???nh s???a th??ng tin l???p n??y'
                );
            }

            res.json({
                success: true,
                message: 'C???p nh???t th??ng tin l???p th??nh c??ng',
                classroom: updatedClassroom,
            });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });

            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };

    delete = async(req, res) => {
        try {
            const classroomDeleteCondition = {
                _id: req.params.classroomId,
                teacherId: req.userId,
            };

            const deleteClassroom = await Classroom.findOne(
                classroomDeleteCondition
            ).lean();

            if (!deleteClassroom) {
                throw new Error('B???n kh??ng c?? quy???n x??a l???p n??y');
            }

            //  delete all comment & post have classroomId
            await Comment.deleteMany({ classroomId: req.params.classroomId });
            await Post.deleteMany({ classroomId: req.params.classroomId });

            // delete classroom id from user
            //teacher
            let teacher = await User.findOne({
                _id: deleteClassroom.teacherId,
            });
            teacher.classTeacher.pull({ _id: req.params.classroomId });

            await teacher.save();

            //student

            for (let studentId of deleteClassroom.listStudent) {
                let student = await User.findOne({ _id: studentId });

                student.classStudent.pull({ _id: req.params.classroomId });
                await student.save();
            }

            // TODO: X??a homework, document, submission ulatr :#333

            // delete classroom
            await Classroom.deleteOne({ _id: req.params.classroomId });
            res.json({
                success: true,
                message: 'X??a l???p th??nh c??ng',
                classroom: deleteClassroom,
            });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };

    join = async(req, res) => {
        const { code } = req.body;
        try {
            let updatedClassroom = await Classroom.findOne({ code: code });

            if (!updatedClassroom) {
                throw new Error('Kh??ng t??m th???y l???p h???c n??y');
            }

            if (
                updatedClassroom.teacherId == req.userId ||
                updatedClassroom.listStudent.includes(req.userId)
            ) {
                throw new Error('Ng?????i d??ng ???? tham gia l???p n??y');
            }

            updatedClassroom.listStudent.push(req.userId);
            updatedClassroom.numberOfMember += 1;   
            await updatedClassroom.save();

            // TODO: c???p nh???t danh s??ch classroom c??a user
            let updatedMember = await User.findOne({ _id: req.userId });
            updatedMember.classStudent.push(updatedClassroom._id);
            await updatedMember.save();

            await createDefaultSubmissionForEveryHomeworkInClass(
                code,
                req.userId
            );

            res.json({
                success: true,
                message: 'Tham gia l???p h???c th??nh c??ng',
                classroom: updatedClassroom,
            });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };
    removeStudent = async(req, res) => {
        const { studentId } = req.body;

        try {
            const classroomUpdateCondition = {
                _id: req.params.classroomId,
                teacherId: req.userId,
            };

            let updatedClassroom = await Classroom.findOne(
                classroomUpdateCondition
            );

            if (!updatedClassroom) {
                throw new Error('B???n kh??ng c?? quy???n x??a h???c sinh');
            }
            if (!updatedClassroom.listStudent.includes(studentId)) {
                throw new Error('H???c sinh n??y kh??ng c?? trong l???p');
            }
            updatedClassroom.listStudent.pull({ _id: studentId });

            updatedClassroom.numberOfMember -= 1;
            await updatedClassroom.save();

            // TODO: c???p nh???t danh s??ch classroom c??a user
            let updatedMember = await User.findOne({ _id: studentId });
            updatedMember.classStudent.pull({ _id: req.params.classroomId });

            await updatedMember.save();
            await deleteSubmissionsOfStudentInClass(studentId, req.params.classroomId)
            res.json({
                success: true,
                message: 'X??a h???c sinh th??nh c??ng',
                classroom: updatedClassroom,
            });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };
    leaveClassroom = async(req, res) => {
        try {
            let updatedClassroom = await Classroom.findOne({
                _id: req.params.classroomId,
            });

            if (updatedClassroom.teacherId == req.userId) {
                throw new Error('Gi??o vi??n kh??ng ???????c ph??p r???i l???p!');
            }

            updatedClassroom.listStudent.pull({ _id: req.userId });

            updatedClassroom.numberOfMember -= 1;
            await updatedClassroom.save();

            // TODO: c???p nh???t danh s??ch classroom c??a user
            let updatedMember = await User.findOne({ _id: req.userId });
            updatedMember.classStudent.pull({ _id: req.params.classroomId });

            await updatedMember.save();
            res.json({
                success: true,
                message: 'R???i l???p h???c th??nh c??ng',
                classroom: updatedClassroom,
            });
        } catch (error) {
            if (error.message)
                res.status(400).json({
                    success: false,
                    message: error.message,
                });
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };

    inviteStudent = async(req, res) => {
        const { username } = req.body;

        try {
            const classroomUpdateCondition = {
                _id: req.params.classroomId,
                teacherId: req.userId,
            };

            let updatedClassroom = await Classroom.findOne(
                classroomUpdateCondition
            );

            if (!updatedClassroom) {
                throw new Error('B???n kh??ng c?? quy???n th??m h???c sinh');
            }

            const student = await User.findOne({ username: username });

            if (!student) {
                throw new Error('Kh??ng t???n t???i user n??y');
            }
            if (updatedClassroom.listStudent.includes(student._id)) {
                throw new Error('H???c sinh n??y ???? tham gia l???p h???c');
            }

            if (req.userId == student._id) {
                throw new Error('B???n ???? tham gia l???p h???c');
            }

            updatedClassroom.listStudent.push({ _id: student._id });

            updatedClassroom.numberOfMember += 1;
            await updatedClassroom.save();

            // TODO: c???p nh???t danh s??ch classroom c??a user

            student.classStudent.push({ _id: req.params.classroomId });
            const code = updatedClassroom.code
            await createDefaultSubmissionForEveryHomeworkInClass(code, student._id)
            await student.save();
            res.json({
                success: true,
                message: 'Th??m h???c sinh th??nh c??ng',
                classroom: updatedClassroom,
            });
        } catch (error) {
            if (error.message){
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            } 
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };

    people = async(req, res) => {
        try {
            const classroom = await Classroom.findById(req.params.classroomId)
                .select('teacherId listStudent')
                .populate('teacherId listStudent');

            res.json({ success: true, classroom });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'L???i r???i :(',
            });
        }
    };
}

module.exports = new ClassroomController();