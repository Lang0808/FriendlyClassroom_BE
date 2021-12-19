const User = require('../models/User');
const firebase = require('../firebase');
const mongoose = require('mongoose');
const { ObjectId } = mongoose.Schema.Types;
const argon2 = require('argon2')

const Homework = require('../models/Homework');
const Submission = require('../models/Submission');

getSignedUrlAvatar = async(filename) => {
    const destinationFirebase = `avatar/${filename}`;
    const config = {
        action: 'read',
        expires: '03-17-2025',
    };
    const url = await firebase.bucket.file(destinationFirebase).getSignedUrl(config);
    return url;
};

const checkEmail = (email) => {
    if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        return true
    }
    return false
}

const checkPhoneNumber = (phoneNumber) => {
    if (/(84|0[3|5|7|8|9])+([0-9]{8})\b/.test(phoneNumber)) {
        return true
    }
    return false
}

const getFilenameExtension = (filename) => {
    const names = filename.split('.')
    return names[names.length - 1]
}

class UserController {
    getInformation = (req, res) => {
        try {
            const userId = req.userId;
            const username = req.username;
            User.findOne({ username: username })
                .populate({
                    path: 'classStudent classTeacher',
                    select: 'name code description teacherId numberOfMember',
                    populate: {
                        path: 'teacherId',
                        select: 'fullName avatarUrl',
                    },
                })
                .exec(async function(err, user) {
                    try {
                        if (err) {
                            throw new Error('ERROR');
                        }
                    } catch (err) {
                        return res.status(400).json({ success: false, message: 'Lỗi rồi :(' });
                    }
                    return res.status(200).json({ success: true, user });
                });
        } catch (err) {
            console.log(err);
        }
    };
    changeAvatar = (req, res) => {
        try {
            const username = req.username;
            const userId = req.userId;
            const avatar = req.file;
            const ext = avatar.filename.split('.')[1];
            const filename = `${userId}.${ext}`;
            const filePath = `avatar/${filename}`;
            var options = {
                destination: filePath,
            };
            firebase.bucket.upload(avatar.path, options, async(err, item) => {
                try {
                    if (err) {
                        console.log(err);
                        throw new Error('ERROR');
                    }
                } catch (err) {
                    return res.status(400).json({ success: false, message: 'Lỗi rồi :<' });
                }
                const signedUrl = await getSignedUrlAvatar(filename);
                await User.updateOne({ username: username }, { $set: { avatarUrl: signedUrl[0] } });
                return res.status(200).json({ success: true, message: 'Thay đổi avatar thành công !!!' });
            });
        } catch (err) {
            console.log(err);
            return res.status(400).json({ success: false, message: 'Lỗi rồi :<' });
        }
    };
    isUserATeacherOfClass = async(userId, classroomId) => {
        const user = await User.find({
            _id: userId,
            classTeacher: { $in: [classroomId] },
        });
        /*var isOK = false
            user.classTeacher.forEach(element => {
                if (element.toString() === classroomId) {
                    isOK = true
                    return
                }
            });*/
        // console.log(user)
        if (user.length > 0) return true;
        else return false;
    };
    isUserAStudentOfClass = async(userId, classroomId) => {
        const user = await User.findOne({ _id: userId }, 'classStudent');
        var isOK = false;
        user.classStudent.forEach((element) => {
            // console.log(element.toString())
            // console.log(classroomId)
            if (element.toString() === classroomId) {
                isOK = true;
                return;
            }
        });
        return isOK;
    };
    isUserAMemberOfClass = async(userId, classroomId) => {
        const user = await User.findOne({ _id: userId }, 'classStudent classTeacher');
        if (classroomId in user.classStudent || classroomId in user.classTeacher) {
            return true;
        }
        return false;
    };

    // ydam
    todo = async(req, res) => {
        try {
            let submissions = await Submission.find({ studentId: req.userId })
                .select('homeworkId markDone')
                .populate('homeworkId')
                .populate({
                    path: 'homeworkId',
                    populate: [{ path: 'classroomId', select: 'name' }],
                    options: {
                        sort: { deadline: -1 },
                    },
                    select: 'classroomId title topic deadline',
                });

            res.json({ success: true, submissions: submissions });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'Lỗi rồi :(',
            });
        }
    };
    calendar = async(req, res) => {
        try {
            let submissions = await Submission.find({ studentId: req.userId })
                .select('homeworkId markDone')
                .populate('homeworkId')
                .populate({
                    path: 'homeworkId',
                    populate: [{ path: 'classroomId', select: 'name' }],
                    options: {
                        sort: { deadline: -1 },
                    },
                    select: 'classroomId title topic deadline',
                });

            res.json({ success: true, submissions: submissions });
        } catch (error) {
            console.log(error);
            res.status(500).json({
                success: false,
                message: 'Lỗi rồi :(',
            });
        }
    };
    changeInformation = async(req, res) => {
        try {
            const username = req.body.username;
            var password = req.body.password;
            const email = req.body.email;
            const phoneNumber = req.body.phoneNumber;
            const fullName = req.body.fullName;
            const userId = req.userId
            const file = req.file
            const ext = getFilenameExtension(file.filename)
            const filename = `${userId}.${ext}`
            password = await argon2.hash(password)
            if (!checkEmail(email)) throw new Error("not a email")
            if (!checkPhoneNumber(phoneNumber)) throw new Error("not a phone number")

            const user = await User.findOne({ username });
            if (user) {
                throw new Error("Username already taken")
            }
            password = await argon2.hash(password);
            // TODO: consider how to delete old avatar in Firebase
            const options = {
                destination: `avatar/${filename}`
            }
            await firebase.bucket.upload(file.path, options)
            const urls = getSignedUrlAvatar(filename)
            await User.updateOne({ _id: userId }, { username: username, password: password, email: email, phoneNumber: phoneNumber, fullName: fullName, avatarUrl: urls[0] })
            return res.status(200).json({ success: true, message: 'Change user information successfully' })
        } catch (err) {
            if (err.message === 'not a email') return res.status(400).json({ success: false, message: 'Email sai dinh dang' })
            else if (err.message === 'not a phone number') return res.status(400).json({ success: false, message: 'So dien thoai sai dinh dang' })
            else {
                console.log(err)
                return res.status(400).json({ success: false, message: 'Loi roi :(' })
            }
        }
    }
}

module.exports = new UserController();