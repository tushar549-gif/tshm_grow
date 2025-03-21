const mongoose = require("mongoose");

const depositSchema = new mongoose.Schema({
    uid: { type: Number, required: true },  // Telegram User ID
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    isReactivation: { type: Boolean, required: true } // Indicates if the deposit is for reactivation
});

const Deposit = mongoose.model("Deposit", depositSchema);
module.exports = Deposit;