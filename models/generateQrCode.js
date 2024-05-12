/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

const mongoose = require('mongoose');

const GenerateQrCodeSchema = new mongoose.Schema({
    betId: { type: String, required: true },
    amount: { type: Number, required: true },
    email: String,
    createdAt: String,
    validUntil: String,
    qrcodeStatus: {type: String, required: true, default: "Pending"},
    number: Number,
    fullname: String,
    service: String,
    used: { type: Boolean, required: true, default: false },
    paymentConfirmation: { type: String, required: true, default: "Pending" },
})

module.exports = mongoose.model('QrCodeDeposits', GenerateQrCodeSchema);


