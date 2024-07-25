/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const QrCodeDeposits = require("../models/generateQrCode");
const User = require("../models/user");
const { getDate, getDateInOneHour } = require("../utils/date");
const uuid = require("uuid");
require("dotenv").config();

let transactionInProgress = false;
// Middleware function to check if a transaction is in progress
const checkOngoingTransaction = (req, res, next) => {
  // Check if a transaction is already in progress
  if (transactionInProgress) {
    return res
      .status(400)
      .json({ error: "Another transaction is already in progress" });
  }
  // If no transaction is in progress, allow the route handler to proceed
  next();
};

router.post("/generateQRCode", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;
    const { email, betId, amount } = req.body;
    console.log(email, betId, amount);
    const service = "1xbet";
    // Uncomment below code to fetch user and perform additional checks if required
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(401)
        .json({ success: false, message: "User not found", status: 401 });
    }
    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .json({ success: false, message: "User is deactivated", status: 502 });
    }

    const currentTime = new Date(getDate());
    const twentyFourHoursAgo = currentTime - 24 * 60 * 60 * 1000; // Timestamp for 24 hours ago in milliseconds

    const transactionCount = await QrCodeDeposits.countDocuments({
      email: email,
      createdAt: { $gte: twentyFourHoursAgo },
    });

    if (transactionCount >= 20) {
      transactionInProgress = false;
      return res
        .status(503)
        .json({ success: false, message: "maximum code created", status: 503 });
    }

    // Generate unique QR code ID
    const qrId = uuid.v4();

    // Calculate expiration time (24 hours from now)
    const createdAt = getDate();
    console.log("Current Date/Time:", createdAt);

    const validUntil = getDateInOneHour();
    console.log("Date/Time in One Hour:", validUntil);

    const fullname = existingUser.fullname;
    // Insert QR code data into the database
    // await QRCode.create({ qrId, email, betId, amount, createdAt, validUntil });

    // // Create a new QrCodeDeposits
    const newQrCodeDeposits = new QrCodeDeposits({
      betId,
      amount,
      email,
      qrId,
      createdAt,
      validUntil,
      fullname,
      service,
    });
    await newQrCodeDeposits.save();
    transactionInProgress = false;
    res.status(200).json({
      success: true,
      message: "QR code generated successfully",
      id: newQrCodeDeposits._id,
    });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error generating QR code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});




module.exports = router;
