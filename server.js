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
const JWT_SECRET = process.env.JWT_SECRET || "secretkey";

app.use(cors());
app.use(express.json());

/* -------------------- HELPERS -------------------- */
const normalizeEmail = (email = "") => email.trim().toLowerCase();
const normalizeBadge = (badge = "") => badge.trim().toUpperCase();
const normalizeText = (text = "") => text.trim();

const createLog = async (action, user = "system") => {
    try {
        await Log.create({ action, user });
    } catch (error) {
        console.error("Log creation error:", error.message);
    }
};

/* -------------------- DATABASE -------------------- */
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected");
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error.message);
    });

/* -------------------- ROOT -------------------- */
app.get("/", (req, res) => {
    res.json({
        message: "BOM3 backend is running"
    });
});

/* -------------------- REGISTER USER -------------------- */
app.post("/register", async (req, res) => {
    try {
        const { email, password, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const cleanEmail = normalizeEmail(email);

        const existingUser = await User.findOne({ email: cleanEmail });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            email: cleanEmail,
            password: hashedPassword,
            role: role || "member"
        });

        await createLog(`Account registered: ${cleanEmail}`, cleanEmail);

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

/* -------------------- LOGIN USER -------------------- */
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const cleanEmail = normalizeEmail(email);

        const user = await User.findOne({ email: cleanEmail });

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
            JWT_SECRET,
            { expiresIn: "1d" }
        );

        await createLog(`Login successful: ${cleanEmail}`, cleanEmail);

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

/* -------------------- ADD MEMBER -------------------- */
app.post("/members", async (req, res) => {
    try {
        const { firstName, lastName, email, address, phone, badge } = req.body;

        if (!firstName || !lastName || !email || !address || !phone || !badge) {
            return res.status(400).json({
                message: "Please fill in all fields."
            });
        }

        const cleanEmail = normalizeEmail(email);
        const cleanBadge = normalizeBadge(badge);

        const badgeExists = await Member.findOne({ badge: cleanBadge });
        if (badgeExists) {
            return res.status(400).json({
                message: "Badge number already exists."
            });
        }

        const emailExists = await Member.findOne({ email: cleanEmail });
        if (emailExists) {
            return res.status(400).json({
                message: "Email already exists."
            });
        }

        const newMember = await Member.create({
            firstName: normalizeText(firstName),
            lastName: normalizeText(lastName),
            email: cleanEmail,
            address: normalizeText(address),
            phone: normalizeText(phone),
            badge: cleanBadge
        });

        await createLog(`Member added: ${cleanEmail}`, cleanEmail);

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

/* -------------------- GET ALL MEMBERS WITH ACCOUNT STATUS -------------------- */
app.get("/members", async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        const users = await User.find({}, "email role");

        const userMap = new Map();
        users.forEach((user) => {
            userMap.set(normalizeEmail(user.email), user);
        });

        const mergedMembers = members.map((member) => {
            const matchedUser = userMap.get(normalizeEmail(member.email));

            return {
                ...member.toObject(),
                hasAccount: !!matchedUser,
                accountRole: matchedUser ? matchedUser.role : null
            };
        });

        res.json(mergedMembers);
    } catch (error) {
        console.error("Get members error:", error.message);
        res.status(500).json({
            message: "Server error while fetching members."
        });
    }
});

/* -------------------- GET ALL USERS -------------------- */
app.get("/users", async (req, res) => {
    try {
        const users = await User.find({}, "-password").sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error("Get users error:", error.message);
        res.status(500).json({
            message: "Server error while fetching users."
        });
    }
});

/* -------------------- UPGRADE / CHANGE USER ROLE -------------------- */
app.patch("/users/:email/role", async (req, res) => {
    try {
        const email = normalizeEmail(req.params.email);
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({
                message: "Role is required."
            });
        }

        const allowedRoles = ["member", "admin", "owner"];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message: "Invalid role."
            });
        }

        const updatedUser = await User.findOneAndUpdate(
            { email },
            { role },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                message: "No account found for this email."
            });
        }

        await createLog(`Role updated to ${role}: ${email}`, email);

        res.json({
            message: "User role updated successfully",
            user: {
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (error) {
        console.error("Update role error:", error.message);
        res.status(500).json({
            message: "Server error while updating role."
        });
    }
});

/* -------------------- DELETE MEMBER -------------------- */
app.delete("/members/:email", async (req, res) => {
    try {
        const email = normalizeEmail(req.params.email);

        const deletedMember = await Member.findOneAndDelete({ email });

        if (!deletedMember) {
            return res.status(404).json({
                message: "Member not found."
            });
        }

        await createLog(`Member removed: ${email}`, email);

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

/* -------------------- DELETE USER ACCOUNT -------------------- */
app.delete("/users/:email", async (req, res) => {
    try {
        const email = normalizeEmail(req.params.email);

        const deletedUser = await User.findOneAndDelete({ email });

        if (!deletedUser) {
            return res.status(404).json({
                message: "User account not found."
            });
        }

        await createLog(`Account deleted: ${email}`, email);

        res.json({
            message: "User account deleted successfully"
        });
    } catch (error) {
        console.error("Delete user error:", error.message);
        res.status(500).json({
            message: "Server error while deleting user account."
        });
    }
});

/* -------------------- ADD LOG -------------------- */
app.post("/logs", async (req, res) => {
    try {
        const { action, user } = req.body;

        if (!action) {
            return res.status(400).json({
                message: "Action is required."
            });
        }

        const newLog = await Log.create({
            action: normalizeText(action),
            user: normalizeText(user || "system")
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

/* -------------------- GET ALL LOGS -------------------- */
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

/* -------------------- CLEAR LOGS -------------------- */
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

/* -------------------- START SERVER -------------------- */
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});