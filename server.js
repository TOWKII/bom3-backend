const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const Member = require("./models/Member");
const Log = require("./models/Log");
const User = require("./models/User");

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

/* REGISTER USER */
app.post("/register", async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const existingUser = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            email: email.trim().toLowerCase(),
            password: hashedPassword,
            role: role || "member"
        });

        res.json({
            message: "Account created successfully",
            user: {
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Register error:", error.message);
        res.status(500).json({
            message: "Server error while creating account."
        });
    }
});

/* LOGIN USER */
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const user = await User.findOne({
            email: email.trim().toLowerCase()
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password."
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(400).json({
                message: "Invalid email or password."
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role
            },
            "secretkey",
            { expiresIn: "1d" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({
            message: "Server error while logging in."
        });
    }
});

/* GET ALL USERS */
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error("Get users error:", error.message);
        res.status(500).json({
            message: "Server error while fetching users."
        });
    }
});

/* UPDATE USER ROLE */
app.patch("/users/:email/role", async (req, res) => {
    try {
        const email = req.params.email.trim().toLowerCase();
        const { role } = req.body;

        if (!role || !["owner", "admin", "member"].includes(role)) {
            return res.status(400).json({
                message: "Invalid role."
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { role },
            { new: true, projection: { password: 0 } }
        );

        if (!updatedUser) {
            return res.status(404).json({
                message: "User not found."
            });
        }

        res.json({
            message: "Role updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Update role error:", error.message);
        res.status(500).json({
            message: "Server error while updating role."
        });
    }
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

/* ADD LOG */
app.post("/logs", async (req, res) => {
    try {
        const { action, user } = req.body;

        if (!action) {
            return res.status(400).json({
                message: "Action is required."
            });
        }

        const newLog = await Log.create({
            action,
            user
        });

        res.json({
            message: "Log added successfully",
            log: newLog
        });
    } catch (error) {
        console.error("Add log error:", error.message);
        res.status(500).json({
            message: "Server error while adding log."
        });
    }
});

/* GET ALL LOGS */
app.get("/logs", async (req, res) => {
    try {
        const logs = await Log.find().sort({ createdAt: -1 });
        res.json(logs);
    } catch (error) {
        console.error("Get logs error:", error.message);
        res.status(500).json({
            message: "Server error while fetching logs."
        });
    }
});

/* CLEAR LOGS */
app.delete("/logs", async (req, res) => {
    try {
        await Log.deleteMany({});
        res.json({
            message: "All logs cleared successfully"
        });
    } catch (error) {
        console.error("Clear logs error:", error.message);
        res.status(500).json({
            message: "Server error while clearing logs."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});