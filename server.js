const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Member = require("./models/Member");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error.message);
    });

/* ADD MEMBER */
app.post("/members", async (req, res) => {
    try {
        const { firstName, lastName, email, address, phone, badge } = req.body;

        if (!firstName || !lastName || !email || !address || !phone || !badge) {
            return res.status(400).json({
                message: "Please fill in all fields."
            });
        }

        const badgeExists = await Member.findOne({
            badge: badge.trim().toUpperCase()
        });

        if (badgeExists) {
            return res.status(400).json({
                message: "Badge number already exists."
            });
        }

        const emailExists = await Member.findOne({
            email: email.trim().toLowerCase()
        });

        if (emailExists) {
            return res.status(400).json({
                message: "Email already exists."
            });
        }

        const newMember = await Member.create({
            firstName,
            lastName,
            email,
            address,
            phone,
            badge
        });

        console.log("New member added:", newMember);

        res.json({
            message: "Member added successfully",
            member: newMember
        });
    } catch (error) {
        console.error("Add member error:", error.message);
        res.status(500).json({
            message: "Server error while adding member."
        });
    }
});

/* GET ALL MEMBERS */
app.get("/members", async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        console.error("Get members error:", error.message);
        res.status(500).json({
            message: "Server error while fetching members."
        });
    }
});

/* DELETE MEMBER */
app.delete("/members/:email", async (req, res) => {
    try {
        const email = req.params.email.trim().toLowerCase();

        await Member.findOneAndDelete({ email });

        res.json({
            message: "Member removed successfully"
        });
    } catch (error) {
        console.error("Delete member error:", error.message);
        res.status(500).json({
            message: "Server error while deleting member."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});