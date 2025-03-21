const mongoose = require("mongoose");

const WithdrawSchema = new mongoose.Schema({
    uid: { type: Number, required: true }, // User's Telegram ID
    amount: { type: Number, required: true }, // Withdrawal Amount
    upi_id: { type: String, required: true }, // UPI ID of the User
    name: { type: String, required: true }, // User's Name
    date: { type: Date, default: Date.now }, // Date of Withdrawal
    status: { type: String, default: "pending" } // Withdrawal Status (pending, approved, rejected)
});

module.exports = mongoose.model("Withdraw", WithdrawSchema);