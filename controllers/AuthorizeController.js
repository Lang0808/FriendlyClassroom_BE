/* const { Router } = require('express')*/
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const argon2 = require('argon2');

const mongoose = require('mongoose')

const generateToken = (payload) => {
    const { id, username } = payload;
    const accessToken = jwt.sign({ id, username },
        process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '10h',
        }
    );
    return accessToken
};

class AuthorizeController {
    signup = async(req, res) => {
        const username = req.body.username;
        var password = req.body.password;
        const gmail = req.body.gmail;
        const phoneNumber = req.body.phoneNumber;
        const fullname = req.body.fullname;
        try {
            const user = await User.findOne({ username: username });
            if (user) {
                return res.status(400).json({
                    success: false,
                    message: 'Username already taken',
                });
            }
            // Test function 
            const classStudent = [
                mongoose.Types.ObjectId('61adf0f4cf5efc346cc0f0a0')
            ]

            password = await argon2.hash(password);
            const newUser = new User({
                username,
                password,
                fullname,
                gmail,
                phoneNumber,
                classStudent // test
            });
            await newUser.save();
            return res
                .status(200)
                .json({ success: true, message: 'User is added' });
        } catch (err) {
            console.log(err);
            res.status(400).json({ success: false, message: 'ERROR' });
        }
    };

    login = async(req, res) => {
        try {
            const username = req.body.username;
            const password = req.body.password;
            User.findOne({ username: username },
                'username password',
                async function(err, user) {
                    if (err) {
                        return res
                            .status(401)
                            .json({ success: false, message: 'ERROR' });
                    }
                    if (!user) {
                        return res.status(401).json({
                            success: false,
                            message: 'User doesnt exist',
                        });
                    }
                    const passwordValid = await argon2.verify(
                        user.password,
                        password
                    );
                    if (!passwordValid) {
                        return res.status(400).json({
                            success: false,
                            message: 'Wrong password',
                        });
                    }
                    const token = generateToken(user);
                    return res.status(200).json({ success: true, token });
                }
            );
        } catch (err) {
            return res.status(400).json({ success: false, message: 'ERROR' });
        }
    };
}

module.exports = new AuthorizeController();