const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    address: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    badge: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    }
}, { timestamps: true });

module.exports = mongoose.model("Member", memberSchema);