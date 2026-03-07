const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
{
    action: String,
    user: String
},
{ timestamps: true }
);

module.exports = mongoose.model("Log", logSchema);