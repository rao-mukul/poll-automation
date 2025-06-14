const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true },
   
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,
    
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);