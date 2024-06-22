const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    otp: {
        type: String
    },
    otpExpiry: {
        type: Date
    }
});

// Password hashing middleware
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        console.log('Password not modified, skipping hashing');
        return next();
    }

    try {
        console.log('Hashing password...');
        this.password = await bcrypt.hash(this.password, 10);
        console.log('Password hashed successfully');
        next();
    } catch (error) {
        console.error('Error hashing password:', error);
        next(error);
    }
});

userSchema.methods.comparePassword = async function(password) {
    console.log('Comparing passwords...');
    const result = await bcrypt.compare(password, this.password);
    console.log('Comparison result:', result);
    return result;
};

module.exports = mongoose.model('User', userSchema);
