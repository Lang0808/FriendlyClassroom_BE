require('dotenv').config();
const mongoose = require('mongoose');

async function connect() {
  try {
    mongoose.connect(process.env.DATABASE_URL);
    console.log('Connect successfully!!!');
  } catch (error) {
    console.log('Connect failure!!!');
  }
}

module.exports = { connect };