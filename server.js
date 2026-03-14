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
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("MongoDB connected");
})
.catch((error) => {
    console.error("MongoDB connection error:", error.message);
});


/* JWT VERIFY MIDDLEWARE */
function verifyToken(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Access denied. No token provided."
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }
}


/* ROLE PERMISSION */
function allowRoles(...roles) {

    return (req, res, next) => {

        if (!req.user || !roles.includes(req.user.role)) {

            return res.status(403).json({
                message: "Forbidden. You do not have permission."
            });

        }

        next();
    };
}



/* REGISTER USER */
app.post("/register", async (req, res) => {

    try {

        const { email, password } = req.body;

        const cleanEmail = email?.trim().toLowerCase();
        const cleanPassword = password?.trim();

        if (!cleanEmail || !cleanPassword) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        /* CHECK IF MEMBER EXISTS */
        const memberExists = await Member.findOne({
            email: cleanEmail
        });

        if (!memberExists) {
            return res.status(400).json({
                message: "This email is not registered as a member."
            });
        }

        /* CHECK IF ACCOUNT ALREADY EXISTS */
        const existingUser = await User.findOne({
            email: cleanEmail
        });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists."
            });
        }

        /* HASH PASSWORD */
        const hashedPassword = await bcrypt.hash(cleanPassword, 10);

        /* CREATE USER */
        const newUser = await User.create({
            email: cleanEmail,
            password: hashedPassword,
            role: "member"
        });

        res.status(201).json({
            message: "Account created successfully",
            user: {
                email: newUser.email,
                role: newUser.role
            }
        });

    }
    catch (error) {

        console.error("Register error:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "User already exists."
            });
        }

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
            JWT_SECRET,
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

    }
    catch (error) {

        console.error("Login error:", error.message);

        res.status(500).json({
            message: "Server error while logging in."
        });

    }

});



/* GET ALL USERS (OWNER ONLY) */
app.get("/users", verifyToken, allowRoles("owner", "admin"), async (req, res) => {

    try {

        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });

        res.json(users);

    }
    catch (error) {

        console.error("Get users error:", error.message);

        res.status(500).json({
            message: "Server error while fetching users."
        });

    }

});



/* UPDATE USER ROLE (OWNER ONLY) */
app.patch("/users/:email/role", verifyToken, allowRoles("owner"), async (req, res) => {

    try {

        const email = req.params.email.trim().toLowerCase();
        const { role } = req.body;

        if (!role || !["owner","admin","member"].includes(role)) {

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

    }
    catch (error) {

        console.error("Update role error:", error.message);

        res.status(500).json({
            message: "Server error while updating role."
        });

    }

});



/* ADD MEMBER (ADMIN + OWNER) */
app.post("/members", verifyToken, allowRoles("owner","admin"), async (req, res) => {

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

        res.json({
            message: "Member added successfully",
            member: newMember
        });

    }
    catch (error) {

        console.error("Add member error:", error.message);

        res.status(500).json({
            message: "Server error while adding member."
        });

    }

});



/* GET ALL MEMBERS (ADMIN + OWNER) */
app.get("/members", verifyToken, allowRoles("owner","admin"), async (req, res) => {

    try {

        const members = await Member.find().sort({ createdAt: -1 });

        res.json(members);

    }
    catch (error) {

        console.error("Get members error:", error.message);

        res.status(500).json({
            message: "Server error while fetching members."
        });

    }

});



/* DELETE MEMBER (ADMIN + OWNER) */
app.delete("/members/:email", verifyToken, allowRoles("owner","admin"), async (req, res) => {

    try {

        const email = req.params.email.trim().toLowerCase();

        await Member.findOneAndDelete({ email });

        res.json({
            message: "Member removed successfully"
        });

    }
    catch (error) {

        console.error("Delete member error:", error.message);

        res.status(500).json({
            message: "Server error while deleting member."
        });

    }

});



/* ADD LOG */
app.post("/logs", verifyToken, allowRoles("owner","admin"), async (req, res) => {

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

    }
    catch (error) {

        console.error("Add log error:", error.message);

        res.status(500).json({
            message: "Server error while adding log."
        });

    }

});



/* GET ALL LOGS */
app.get("/logs", verifyToken, allowRoles("owner","admin"), async (req, res) => {

    try {

        const logs = await Log.find().sort({ createdAt: -1 });

        res.json(logs);

    }
    catch (error) {

        console.error("Get logs error:", error.message);

        res.status(500).json({
            message: "Server error while fetching logs."
        });

    }

});



/* CLEAR LOGS (OWNER ONLY) */
app.delete("/logs", verifyToken, allowRoles("owner"), async (req, res) => {

    try {

        await Log.deleteMany({});

        res.json({
            message: "All logs cleared successfully"
        });

    }
    catch (error) {

        console.error("Clear logs error:", error.message);

        res.status(500).json({
            message: "Server error while clearing logs."
        });

    }

});

app.get("/members/me", verifyToken, async (req, res) => {
    try {

        const member = await Member.findOne({
            email: req.user.email.trim().toLowerCase()
        });

        if (!member) {
            return res.status(404).json({
                message: "Member not found."
            });
        }

        res.json(member);

    } catch (error) {

        console.error("Get member error:", error.message);

        res.status(500).json({
            message: "Server error while fetching member."
        });

    }
});
app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);

});