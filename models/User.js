/*const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    uid: { type: Number, required: true, unique: true }, // Unique user ID
    username: { type: String, required: true, unique: true }, // Unique username
    balance: { type: Number, default: 0 }, // User balance
    referredBy: { type: Number, default: null }, // UID of the referrer
    status: { type: String, enum: ["active", "inactive"], default: "inactive" }, // Account status
    registrationDate: { type: Date, default: Date.now }, // Store registration date
    lastCheckIn: { type: Date, default: null } // Track last check-in date
});

const User = mongoose.model("User", userSchema);
module.exports = User;
*/

require("dotenv").config(); // Load environment variables
const mongoose = require("mongoose");

// Connect to MongoDB Atlas securely using environment variables
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ Connected to MongoDB Atlas"))
    .catch(err => console.error("❌ MongoDB Atlas Connection Error:", err));

const userSchema = new mongoose.Schema({
    uid: { type: Number, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
    referralBalance: { type: Number, default: 0 },
    referredBy: { type: Number, default: null },
    referralRewardGiven: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    registrationDate: { type: Date, default: Date.now },
    lastCheckIn: { type: Date, default: null }
});

const User = mongoose.model("User", userSchema);
module.exports = User;