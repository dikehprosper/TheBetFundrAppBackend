/* eslint-disable @typescript-eslint/no-unused-vars */


/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const AdminUser = require("../models/admin");
const { makePaymentRequest } = require("../helpers/makePaymentRequest");
const jwt = require("jsonwebtoken");
const QrCodeDeposits = require("../models/generateQrCode");
const { getDate, getDateInOneHour } = require("../utils/date");
const date = new Date();
// const { FedaPay, Customer } = require("fedapay");
const { check, validationResult } = require("express-validator");
const SendEmail = require("../utils/mailer");
require("dotenv").config();
const { validateDepositRequest } = require("../helpers/checkVerificationForInput");
const { rechargeAccount, checkBalance, withdrawFromAccount } = require('./mobcash');
const paymentEvents = require('../helpers/events');



// FedaPay.setApiKey(process.env.FEDAPAY_KEY1);
// FedaPay.setEnvironment(process.env.ENVIRONMENT1);
const tokenVlaue = process.env.TOKEN_SECRET;

const signInValidate = [
    check("fullname")
        .isLength({ min: 2 })
        .withMessage("Your full name is required"),
    check("email").isEmail().withMessage("Please provide a valid email"),
    check("password")
        .isLength({ min: 4 })
        .withMessage("Password must be at least six characters"),
];

const loginValidate = [
    check("email").isEmail().withMessage("Please provide a valid email"),
    check("password")
        .isLength({ min: 4 })
        .withMessage("Password must be at least six characters"),
];

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

router.post(
    "/register",
    checkOngoingTransaction,
    signInValidate,
    async (req, res) => {
        console.log("fullname");
        checkOngoingTransaction;
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        try {
            transactionInProgress = true;
            const { fullname, betId, number, email, password, referrerId } = req.body;
            console.log(fullname, betId, number, email, password, referrerId, "jjjj");

            // Check if the user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                transactionInProgress = false;
                return res
                    .status(400)
                    .send({ success: 400, message: "User already exists", status: 400 });
            }

            let referrerIdMail;
            if (referrerId) {
                const user2 = await User.findOne({ tag: referrerId });
                if (user2) {
                    user2.referrals.push(email);
                    referrerIdMail = user2.email;
                    await user2.save();
                } else if (!user2) {
                    transactionInProgress = false;
                    return res.send({
                        success: 503,
                        message: "Referer does not exist",
                        status: 503,
                    });
                }
            }

            // Hash the password
            const hashedPassword = await bcryptjs.hash(password, 10);

            const count = await User.countDocuments();
            const parts = fullname.split(" ");
            let firstName = parts[0];
            const name = firstName.replace(/\d/g, "");

            const tag = `betfundr-${name}${count + 1}`;

            // Create a new user
            const newUser = new User({
                fullname,
                betId,
                number,
                email,
                password: hashedPassword,
                isUser: true,
                isLoggedIn: true,
                sessionId: generateUniqueSessionId(),
                supplementaryBetId: [betId],
                registrationDateTime: new Date(),
                image: "",
                tag: tag,
                colorScheme: 2,
                referer: referrerIdMail ? referrerIdMail : ""
            });

            // Save the user to the database
            const savedUser = await newUser.save();

            console.log(savedUser, "saved user");

            // Create token data
            const tokenData = {
                _id: savedUser._id,
                fullname: savedUser.fullname,
                email: savedUser.email,
                isAdmin: savedUser.isAdmin,
                isUser: savedUser.isUser,
                isSubAdminDeposits: savedUser.isSubAdminDeposits,
                isSubAdminWithdrawals: savedUser.isSubAdminWithdrawals,
                sessionId: savedUser.sessionId,
                pinState: savedUser.pinState,
            };

            // Create token
            const token = await jwt.sign(tokenData, tokenVlaue);

            // Send the welcome email without blocking the user registration process
            try {
                await SendEmail({
                    email: savedUser.email,
                    userId: savedUser._id,
                    emailType: "WELCOME",
                    fullname: savedUser.fullname,
                });
            } catch (emailError) {
                console.error("Failed to send welcome email:", emailError);
                // Optionally, you can log this failure or send a different notification to admins
            }

            transactionInProgress = false;
            res.header("auth-token", token).send({
                message: "Registered successfully",
                token,
                success: true,
                savedUser: savedUser,
                status: 201,
            });
        } catch (error) {
            transactionInProgress = false;
            console.error("Error registering user:", error);
            return res
                .status(500)
                .send({ success: false, message: "Internal server error" });
        }
    }
);

router.post(
    "/login",
    checkOngoingTransaction,
    loginValidate,
    async (req, res) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            {
                return res.status(422).json({ errors: errors.array() });
            }
        }
        try {
            transactionInProgress = true;
            const { email, password } = req.body;
            console.log(email);
            // Check if the user already exists
            const existingUser = await User.findOne({ email });
            if (!existingUser) {
                transactionInProgress = false;
                return res
                    .status(501)
                    .send({ success: 501, message: "User does not exists", status: 501 });
            }

            if (!existingUser.isActivated) {
                transactionInProgress = false;
                return res
                    .status(502)
                    .send({ success: 502, message: "User is deactivated", status: 502 });
            }

            // Check if password is correct
            const validPassword = await bcryptjs.compare(
                password,
                existingUser.password
            );
            if (!validPassword) {
                transactionInProgress = false;
                return res
                    .status(503)
                    .send({ success: 503, message: "Invalid password", status: 503 });
            }

            if (!existingUser.pinState) {
                transactionInProgress = false;
                return res.status(504).send({
                    success: 504,
                    message: "Pin not set",
                    status: 504,
                    email: existingUser.email,
                });
            }

          

            // Check for existing session and invalidate it
            if (existingUser.isAdmin === false) {
                if (existingUser.sessionId) {
                    // Implement your session invalidation logic here (e.g., update the database record)
                    invalidateSession(existingUser.sessionId);
                }
            }
            const newSessionId = generateUniqueSessionId();
            // Set the user's session ID and isLoggedIn status
            existingUser.sessionId = newSessionId;
            existingUser.isLoggedIn = true;
            const savedUser = await existingUser.save();

            //create token data
            const tokenData = {
                _id: savedUser._id,
                fullname: savedUser.fullname,
                email: savedUser.email,
                isAdmin: savedUser.isAdmin,
                isUser: savedUser.isUser,
                isSubAdminDeposits: savedUser.isSubAdminDeposits,
                isSubAdminWithdrawals: savedUser.isSubAdminWithdrawals,
                sessionId: savedUser.sessionId,
                pinState: savedUser.pinState,
            };

            // create token
            const token = await jwt.sign(tokenData, tokenVlaue);
            transactionInProgress = false;
            res.header("auth-token", token).send({
                success: true,
                message: "Logged in succesfully",
                token,
                status: 201,
                savedUser,
            });
        } catch (error) {
            transactionInProgress = false;
            console.error("Error ligining in user:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);


router.post("/resetPassword", async (req, res) => {
    try {
        const { email } = req.body;
        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res
                .status(501)
                .send({ success: 501, message: "User does not exists", status: 501 });
        }

        if (!existingUser.isActivated) {
            return res
                .status(502)
                .send({ success: 502, message: "User is deactivated", status: 502 });
        }

        console.log("second check");
        await SendEmail({
            email,
            userId: existingUser._id,
            emailType: "RESET",
            fullname: existingUser.fullname,
        });

        return res
            .status(201)
            .send({ success: true, message: "successful", status: 201 });
    } catch (error) {
        console.error("Error logining in user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post(
    "/checkQRCodeValidity",
    checkOngoingTransaction,
    async (req, res) => {
        try {
            const qrId = req.body.qrId;
            console.log(qrId, "pppppppppppppp");
            // Retrieve QR code data from the database based on qrId
            const qrCodeData = await QrCodeDeposits.findOne({ _id: qrId });
            console.log(qrCodeData);

            if (!qrCodeData) {
                return res
                    .status(404)
                    .json({ success: 404, message: "QR code not found", status: 404 });
            }

            // Get current time
            const currentTimeMillis = new Date(getDate()).getTime();
            const qrCodeDataVaidUntilTimeMillis = new Date(
                qrCodeData.validUntil
            ).getTime();

            // Compare current time with expiration time
            if (currentTimeMillis < qrCodeDataVaidUntilTimeMillis) {
                console.log("first checkkkkkkk");
                const data = {
                    fullname: qrCodeData.fullname,
                    amount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    email: qrCodeData.email,
                    createdAt: qrCodeData.createdAt,
                    validUntil: qrCodeData.validUntil,
                    used: qrCodeData.used,
                    qrcodeStatus: qrCodeData.qrcodeStatus,
                    service: qrCodeData.service,
                    paymentConfirmation: qrCodeData.paymentConfirmation,
                    id: qrCodeData._id,
                };

                res.setHeader("Cache-Control", "no-store");

                return res.status(200).json({
                    success: true,
                    message: "QR code is still valid",
                    status: 200,
                    data,
                });
            } else {
                qrCodeData.qrcodeStatus = "Expired";
                await qrCodeData.save();
                return res
                    .status(400)
                    .json({ success: 400, message: "QR code has expired", status: 400 });
            }
        } catch (error) {
            console.error("Error checking QR code validity:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    }
);

router.get("/getQRCode", async (req, res) => {
    try {
        console.log("done");
        const qrCodeDeposits = await QrCodeDeposits.find({});

        if (!qrCodeDeposits || qrCodeDeposits.length === 0) {
            return res
                .status(404)
                .json({ success: false, message: "No QR codes found", status: 404 });
        }

     

        const qrCodeDataArray = qrCodeDeposits.filter(qrCodeData => qrCodeData.used === false && qrCodeData.qrcodeStatus === "Pending" )
            .map(qrCodeData => ({
                id: qrCodeData._id
            }));


        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({
            success: true,
            message: "QR codes retrieved successfully",
            status: 200,
            data: qrCodeDataArray,
        });
    } catch (error) {
        console.error("Error checking QR code validity:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/noLogindeposit", checkOngoingTransaction, async (req, res) => {
    try {
        transactionInProgress = true;
        const { momoNumber, network, id } = req.body;
        console.log(network, "hbvjbvd");
        const bonusBalance = null;

        let updatedAmount;

        if (bonusBalance === null) {
            // Uncomment below code to fetch user and perform additional checks if required
            const qrCodeData = await QrCodeDeposits.findOne({ _id: id });
            console.log(qrCodeData);
            const email = qrCodeData.email;
            const user = await User.findOne({ email });

            console.log(qrCodeData, email);
            updatedAmount = qrCodeData.amount;
            if (qrCodeData.qrcodeStatus === "Expired") {
                transactionInProgress = false;
                return res
                    .status(505)
                    .json({
                        success: 505,
                        message: "transaction is expired",
                        status: 505,
                    });
            }

            if (!user) {
                transactionInProgress = false;
                return res
                    .status(401)
                    .json({ success: 401, message: "User not found", status: 401 });
            }
            if (!user.isActivated) {
                transactionInProgress = false;
                return res
                    .status(502)
                    .json({ success: 502, message: "User is deactivated", status: 502 });
            }



            // Find available admin
            const admin = await AdminUser.findOne({ isAdmin: true });
            if (admin.isDepositsOpen === false) {
                transactionInProgress = false;
                return res
                    .status(504)
                    .json({
                        success: 504,
                        message: "currently under maintainance",
                        status: 504,
                    });
            }
            const date = new Date();
            const newUuid = generateUniqueShortUuid(15);
            const fullname = user.fullname

            // Check for similar transactions in the last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // Corrected the time calculation

            const recentTransaction = admin.transactionHistory.find(transaction => {
                console.log('Checking transaction:', transaction);

                const betIdMatch = transaction.betId === qrCodeData.betId;
                const amountMatch = parseFloat(transaction.amount) === parseFloat(qrCodeData.amount);
                const paymentConfirmationMatch = transaction.paymentConfirmation === "Successful";
                const statusMatch = transaction.status === "Successful";
                const registrationTimeCheck = new Date(transaction.registrationDateTime) >= fiveMinutesAgo;
                const isRecent = (
                    betIdMatch &&
                    amountMatch &&
                    paymentConfirmationMatch &&
                    statusMatch &&
                    registrationTimeCheck
                );

                console.log('Overall condition:', isRecent);
                return isRecent;
            });

            if (recentTransaction !== undefined) {
                const userTransaction = {
                    status: "Failed",
                    registrationDateTime: date,
                    momoNumber: momoNumber,
                    service: qrCodeData.service,
                    paymentConfirmation: "Pending",
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                    network: network,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    customErrorCode: 300,
            
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Failed",
                    registrationDateTime: date,
                    network: network,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    subadminEmail: "none",
                    service: service,
                    paymentConfirmation: "Failed",
                    customErrorCode: 300,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                });

                await admin.save();
                await user.save();
                console.log("done")
                // Return a JSON response with the transaction status
                transactionInProgress = false;
                return res.status(508).json({
                    success: 508,
                    message: "failed to generate",
                    userTransaction,
                    user
                });
            }
            // console.log("API Response:");
            const result = await makePaymentRequest(updatedAmount, "67634291", network, fullname, newUuid
            );
            console.log("API Response:", result);



            if (result.status !== "SUCCESSFUL") {
                if (result.status === 'PENDING') {
                    const userTransaction = {
                        status: "Pending",
                        registrationDateTime: date,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        network: network,
                        paymentConfirmation: "Pending",
                        customErrorCode: 302,
                        transactionId: newUuid,
                        createdAt: date,
                        amount: qrCodeData.amount,
                        totalAmount: qrCodeData.amount,
                        betId: qrCodeData.betId,
                        service: qrCodeData.service,
                        authenticatedDeposit: false,
                        QrCodeDepositsId: qrCodeData._id,
                    };
                    user.transactionHistory.push(userTransaction);
                    admin.transactionHistory.push({
                        userid: user._id,
                        status: "Pending",                   
                          registrationDateTime: date,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        paymentConfirmation: "Pending",
                        customErrorCode: 302,
                        network: network,
                        amount: qrCodeData.amount,
                        totalAmount: qrCodeData.amount,
                        betId: qrCodeData.betId,
                        service: qrCodeData.service,
                        authenticatedDeposit: false,
                        QrCodeDepositsId: qrCodeData._id,
                    });
                    admin.pendingTransactions.push({
                        userid: user._id,
                        status: "Pending", 
                        registrationDateTime: date,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        paymentConfirmation: "Pending",
                        customErrorCode: 302,
                        network: network,
                        amount: qrCodeData.amount,
                        totalAmount: qrCodeData.amount,
                        betId: qrCodeData.betId,
                        service: qrCodeData.service,
                        // authenticatedDeposit: false,
                        // QrCodeDepositsId: qrCodeData._id,
                    });

                    await admin.save();
                    await user.save();
                    qrCodeData.used = true;
                    await qrCodeData.save();
                    // Return a JSON response with the transaction status
                    transactionInProgress = false;
                    return res
                        .status(209)
                        .json({
                            success: 209,
                            message: "failed to generate",
                            userTransaction,
                            user
                        });
                } else {
                    const userTransaction = {
                        fundingType: "deposits",
                        identifierId: newUuid,
                        paymentConfirmation: "Failed",
                        customErrorCode: 302,
                        status: "Failed",
                        registrationDateTime: date,
                        momoNumber: momoNumber,
                        network: network,
                        transactionId: newUuid,
                        createdAt: date,
                        amount: qrCodeData.amount,
                        totalAmount: qrCodeData.amount,
                        betId: qrCodeData.betId,
                        service: qrCodeData.service,
                        authenticatedDeposit: false,
                        QrCodeDepositsId: qrCodeData._id,
                    };
                    user.transactionHistory.push(userTransaction);
                    admin.transactionHistory.push({
                        network: network,
                      
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        customErrorCode: 302,
                        userid: user._id,
                        status: "Failed",
                        registrationDateTime: date,
                        amount: qrCodeData.amount,
                        totalAmount: qrCodeData.amount,
                        betId: qrCodeData.betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        service: qrCodeData.service,
                        paymentConfirmation: "Failed",
                        authenticatedDeposit: false,
                        QrCodeDepositsId: qrCodeData._id,
                    });

                    await admin.save();
                    await user.save();
                    // Return a JSON response with the transaction status
                    transactionInProgress = false;
                    return res
                        .status(209)
                        .json({
                            success: 209,
                            message: "failed to generate",
                            userTransaction,
                            user
                        });
                }

            }



            const response = await rechargeAccount(betId, amount);
            if (response.Success === false && response.MessageId === 100337) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    network: network,
                    paymentConfirmation: "Successful",
                    customErrorCode: 300,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    network: network,
                    subadminEmail: "none",
                    paymentConfirmation: "Successful",
                    customErrorCode: 300,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                });
                qrCodeData.used = true;
                await qrCodeData.save();
                await admin.save();
                await user.save();
        
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }
      

            if (response.Success === false && response.MessageId === 100323) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    network: network,
                    paymentConfirmation: "Successful",
                    customErrorCode: 301,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    network: network,
                    subadminEmail: "none",
                    paymentConfirmation: "Successful",
                    customErrorCode: 301,
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                });
                await admin.save();
                await user.save();
                qrCodeData.used = true;

                await qrCodeData.save();
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }

            if (response.Success === false) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    network: network,
                    paymentConfirmation: "Successful",
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    network: network,
                    subadminEmail: "none",
                    paymentConfirmation: "Successful",
                    amount: qrCodeData.amount,
                    totalAmount: qrCodeData.amount,
                    betId: qrCodeData.betId,
                    service: qrCodeData.service,
                    authenticatedDeposit: false,
                    QrCodeDepositsId: qrCodeData._id,
                });
                qrCodeData.used = true;

                await qrCodeData.save();
                await admin.save();
                await user.save();
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }


            const userTransaction = {
                status: "Successful",
                registrationDateTime: date,
                network: network,
                paymentConfirmation: "Successful",
                amount: qrCodeData.amount,
                totalAmount: qrCodeData.amount,
                betId: qrCodeData.betId,
                // momoName: momoName,
                momoNumber: momoNumber,
                fundingType: "deposits",
                identifierId: newUuid,
                service: qrCodeData.service,
                authenticatedDeposit: false,
                QrCodeDepositsId: qrCodeData._id,
            };
            user.transactionHistory.push(userTransaction);
            admin.transactionHistory.push({
                userid: user._id,
                status: "Successful",
                momoNumber: momoNumber,
                fundingType: "deposits",
                identifierId: newUuid,
                userEmail: email,
                network: network,
                subadminEmail: "none",
                paymentConfirmation: "Successful",
                amount: qrCodeData.amount,
                totalAmount: qrCodeData.amount,
                betId: qrCodeData.betId,
                service: qrCodeData.service,
                authenticatedDeposit: false,
                QrCodeDepositsId: qrCodeData._id,
            });
           
            qrCodeData.used = true;

            await qrCodeData.save();
            await admin.save();
            await user.save();

            // Return a JSON response with the transaction status
            transactionInProgress = false;
            res
                .status(200)
                .json({ success: true, message: "transaction generated successfully" });
        }
    } catch (error) {
        transactionInProgress = false;
        console.error("Error completing the request for deposit:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});



router.post("/deposit", async (req, res) => {

    const { status, transref, specialfield1, amount, serviceref, code } = req.body;
    // Emit an event when data is received
    paymentEvents.emit('transactionReceived', { status, transref, specialfield1, amount, serviceref, code });

    console.log('Received transaction dataaaa:');
    console.log(`status: ${status}`);
    console.log(`transref: ${transref}`);
    console.log(`specialfield1: ${specialfield1}`);
    console.log(`amount: ${amount}`);
    console.log(`serviceref: ${serviceref}`);
    console.log(`code: ${code}`);
    // Here you can add logic to handle the transaction data, such as saving it to a database

    res.status(200).send('Transaction data received successfully');
});

router.post("/deposit2", async (req, res) => {

    try {
        transactionInProgress = true;
        const { _id, email, betId, amount, momoNumber, network, service } =
            req.body;

        const bonusBalance = null
        // Validate the request body

        let updatedAmount;
        if (bonusBalance === null) {
            updatedAmount = amount;

            // Uncomment below code to fetch user and perform additional checks if required
            const user = await User.findOne({ email });
            if (!user) {
                transactionInProgress = false;
                return res
                    .status(401)
                    .json({ success: 401, message: "User not found", status: 401 });
            }
            if (!user.isActivated) {
                transactionInProgress = false;
                return res
                    .status(502)
                    .json({ success: 502, message: "User is deactivated", status: 502 });
            }

            console.log("entered")
            // Find available admin
            const admin = await AdminUser.findOne({ isAdmin: true });

            if (admin.isDepositsOpen === false) {
                transactionInProgress = false;
                return res
                    .status(504)
                    .json({
                        success: 504,
                        message: "currently under maintainance",
                        status: 504,
                    });
            }

            const date = new Date();
            const newUuid = generateUniqueShortUuid(15);
            const fullname = user.fullname


            // Check for similar transactions in the last 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000); // Corrected the time calculation

            const recentTransaction = admin.transactionHistory.find(transaction => {
                console.log('Checking transaction:', transaction);

                const betIdMatch = transaction.betId === betId;
                const amountMatch = parseFloat(transaction.amount) === parseFloat(amount);
                const paymentConfirmationMatch = transaction.paymentConfirmation === "Successful";
                const statusMatch = transaction.status === "Successful";
                const registrationTimeCheck = new Date(transaction.registrationDateTime) >= fiveMinutesAgo;
                const isRecent = (
                    betIdMatch &&
                    amountMatch &&
                    paymentConfirmationMatch &&
                    statusMatch &&
                    registrationTimeCheck
                );

                console.log('Overall condition:', isRecent);
                return isRecent;
            });

            if (recentTransaction) {
                console.log('Found recent transaction:', recentTransaction);
            } else {
                console.log('No recent transaction found');
            }

            if (recentTransaction !== undefined) {
                const userTransaction = {
                    status: "Failed",
                    registrationDateTime: date,
                    network: network,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: service,
                    paymentConfirmation: "Failed",
                    customErrorCode: 300
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Failed",
                    registrationDateTime: date,
                    network: network,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    // momoName: momoName,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    subadminEmail: "none",
                    service: service,
                    paymentConfirmation: "Failed",
                    customErrorCode: 300
                });
                try {
                    await SendEmail({
                        email: email,
                        userId: user._id,
                        emailType: "FAILEDDEPOSIT",
                        fullname: user.fullname,
                        amount: amount,
                        betId: betId,
                    });
                } catch (emailError) {
                    console.error("Failed to send welcome email:", emailError);
                    // Optionally, you can log this failure or send a different notification to admins
                }

                await admin.save();
                await user.save();
                console.log("done")
                // Return a JSON response with the transaction status
                transactionInProgress = false;
                return res.status(508).json({
                    success: 508,
                    message: "failed to generate",
                    userTransaction,
                    user
                });
            }


            // console.log("API Response:");
            const result = await makePaymentRequest(amount, momoNumber, network, fullname, newUuid
            );
            console.log("API Response:", result);

            if (result.status !== "SUCCESSFUL") {
                if (result.status === 'PENDING') {
                    const userTransaction = {
                        status: "Pending",
                        registrationDateTime: date,
                        amount: amount,
                        totalAmount: amount,
                        betId: betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        network: network,
                        service: service,
                        paymentConfirmation: "Pending",
                        customErrorCode: 302
                    };
                    user.transactionHistory.push(userTransaction);
                    admin.transactionHistory.push({
                        userid: user._id,
                        status: "Pending",
                        registrationDateTime: date,
                        amount: amount,
                        totalAmount: amount,
                        network: network,
                        betId: betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        service: service,
                        paymentConfirmation: "Pending",
                        customErrorCode: 302
                    });
                    admin.pendingTransactions.push({
                        userid: user._id,
                        status: "Pending",
                        registrationDateTime: date,
                        amount: amount,
                        totalAmount: amount,
                        network: network,
                        betId: betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        service: service,
                        paymentConfirmation: "Pending",
                        customErrorCode: 302
                    });

                    await admin.save();
                    await user.save();
                    // Return a JSON response with the transaction status
                    transactionInProgress = false;
                    return res
                        .status(209)
                        .json({
                            success: 209,
                            message: "failed to generate",
                            userTransaction,
                            user
                        });
                } else {
                    const userTransaction = {
                        status: "Failed",
                        registrationDateTime: date,
                        amount: amount,
                        totalAmount: amount,
                        network: network,
                        betId: betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        service: service,
                        paymentConfirmation: "Failed",
                        customErrorCode: 302
                    };
                    user.transactionHistory.push(userTransaction);
                    admin.transactionHistory.push({
                        userid: user._id,
                        status: "Failed",
                        registrationDateTime: date,
                        amount: amount,
                        totalAmount: amount,
                        network: network,
                        betId: betId,
                        // momoName: momoName,
                        momoNumber: momoNumber,
                        fundingType: "deposits",
                        identifierId: newUuid,
                        userEmail: email,
                        subadminEmail: "none",
                        service: service,
                        paymentConfirmation: "Failed",
                        customErrorCode: 302
                    });

                    try {
                        await SendEmail({
                            email: email,
                            userId: user._id,
                            emailType: "FAILEDDEPOSIT",
                            fullname: user.fullname,
                            amount: amount,
                            betId: betId,
                        });
                    } catch (emailError) {
                        console.error("Failed to send welcome email:", emailError);
                        // Optionally, you can log this failure or send a different notification to admins
                    }

                    await admin.save();
                    await user.save();
                    // Return a JSON response with the transaction status
                    transactionInProgress = false;
                    return res
                        .status(209)
                        .json({
                            success: 209,
                            message: "failed to generate",
                            userTransaction,
                            user
                        });
                }

            }
            // // INITIATE MOBCASH TRANSACTION

            const response = await rechargeAccount(betId, amount);
            console.log(response, "response from mobcash");
            if (response.Success === false && response.MessageId === 100337) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    totalAmount: amount,
                    network: network,
                    betId: betId,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: service,
                    paymentConfirmation: "Successful",
                    customErrorCode: 300
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    network: network,
                    subadminEmail: "none",
                    service: service,
                    paymentConfirmation: "Successful",
                    customErrorCode: 300
                });
                await admin.save();
                await user.save();
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }
            if (response.Success === false && response.MessageId === 100323) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: service,
                    network: network,
                    paymentConfirmation: "Successful",
                    customErrorCode: 301
                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    network: network,
                    subadminEmail: "none",
                    service: service,
                    paymentConfirmation: "Successful",
                    customErrorCode: 301
                });
                await admin.save();
                await user.save();
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }
            if (response.Success === false) {
                const userTransaction = {
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    totalAmount: amount,
                    betId: betId,
                    network: network,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    service: service,
                    paymentConfirmation: "Successful",

                };
                user.transactionHistory.push(userTransaction);
                admin.transactionHistory.push({
                    userid: user._id,
                    status: "Pending",
                    registrationDateTime: date,
                    amount: amount,
                    network: network,
                    totalAmount: amount,
                    betId: betId,
                    momoNumber: momoNumber,
                    fundingType: "deposits",
                    identifierId: newUuid,
                    userEmail: email,
                    subadminEmail: "none",
                    service: service,
                    paymentConfirmation: "Successful",
                });
                await admin.save();
                await user.save();
                transactionInProgress = false
                return res.status(200).json({
                    success: true,
                    message: "Transaction wasnt fully completed",
                    userTransaction,
                    user
                });
            }

            const userTransaction = {
                status: "Successful",
                registrationDateTime: date,
                amount: amount,
                totalAmount: amount,
                betId: betId,
                momoNumber: momoNumber,
                fundingType: "deposits",
                identifierId: newUuid,
                service: service,
                paymentConfirmation: "Successful",
                network: network,
            };

            user.transactionHistory.push(userTransaction);
            admin.transactionHistory.push({
                userid: user._id,
                status: "Successful",
                registrationDateTime: date,
                amount: amount,
                totalAmount: amount,
                network: network,
                betId: betId,
                momoNumber: momoNumber,
                fundingType: "deposits",
                identifierId: newUuid,
                userEmail: email,
                subadminEmail: "none",
                service: service,
                paymentConfirmation: "Successful",
            });

            try {
                await SendEmail({
                    email: email,
                    userId: user._id,
                    emailType: "SUCCESSFULDEPOSIT",
                    fullname: user.fullname,
                    amount: amount,
                    betId: betId,
                });
            } catch (emailError) {
                console.error("Failed to send welcome email:", emailError);
                // Optionally, you can log this failure or send a different notification to admins
            }

            const referer = user.referer
            console.log(referer, "fffffff")
            if (user.referer !== "") {
                try {
                    const refererUser = await User.findOne({ email: referer });

                    if (refererUser) {
                        // Calculate bonus percentages
                        const result = calculatePercentage(amount);
                        // Update referer and admin balances
                        refererUser.bonusBalance += result;
                        admin.disbursedBonusBalance += result;


                        // Create user transaction
                        const userTransaction = {
                            status: "Successful",
                            registrationDateTime: date,
                            amount: result,
                            totalAmount: result,
                            fundingType: "bonus",
                            identifierId: newUuid,
                            bonusBalance: result,
                        };

                        // Add transaction to refererUser history
                        refererUser.transactionHistory.push(userTransaction);

                        // Save both users (referer and admin) after transaction
                        await refererUser.save();
                        await admin.save();

                        // Send confirmation email
                        try {
                            await SendEmail({
                                email: refererUser.email,
                                userId: refererUser._id,
                                emailType: "SUCCESSFULBONUS",
                                fullname: refererUser.fullname,
                                amount: randomNumber,
                                betId: refererUser.betId,
                            });
                        } catch (emailError) {
                            console.error("Failed to send bonus email:", emailError);
                        // Optionally, log or notify admins of the email failure
                        }
                    }
                } catch (error) {
                    console.error("Error processing bonus:", error);
                    return NextResponse.json({ error: "An error occurred during bonus processing." }, { status: 500 });
                }
            }


            await admin.save();
            await user.save();
            transactionInProgress = false
            return res.status(200).json({
                success: true,
                message: "Transaction generated successfully",
                userTransaction,

            });
        }
    } catch (error) {
        transactionInProgress = false;
        console.error("Error completing the request for deposit:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/checkPin2", async (req, res) => {
    try {
        const submittedPin = req.body.pin;
        const userId = req.body.email;


        const user = await User.findOne({ email: userId });
        console.log(user.pinreset, submittedPin, "user")
        if (user && user.pinreset === submittedPin) {
            console.log("submittedPin");

            if (user.pinExpiryTime > Date.now()) {
                return res.status(201).send({
                    success: true,
                    message: "PIN verification successful",
                    status: 201,
                });
            } else {
                res.status(401).send("PIN has expired. Please request a new one.");
            }
        } else {
            res.status(402).send("Invalid PIN or user ID.");
        }
    } catch (error) {
        console.error("Error logining in user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.post("/resetPasswordForLoggedInUser2", async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        // Check if the user already exists
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            transactionInProgress = false;
            return res
                .status(501)
                .send({ success: 501, message: "User does not exists", status: 501 });
        }

        if (!existingUser.isActivated) {
            transactionInProgress = false;
            return res
                .status(502)
                .send({ success: 502, message: "User is deactivated", status: 502 });
        }


        const hashedPassword = await bcryptjs.hash(newPassword, 10);

        existingUser.password = hashedPassword;

        // console.log("second check")
        // await SendEmail({
        //     email,
        //     userId: existingUser._id,
        //     emailType: "RESET",
        //     fullname: existingUser.fullname,
        // });
        await existingUser.save();
        transactionInProgress = false;
        return res
            .status(201)
            .send({ success: true, message: "successful", status: 201 });
    } catch (error) {
        transactionInProgress = false;
        console.error("Error logining in user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Function to invalidate a session (update the database record)
async function invalidateSession(sessionId) {
    try {
        // Find the user with the given session ID and update the session or remove it
        const user = await User.findOneAndUpdate(
            { sessionId },
            { $set: { sessionId: null, isLoggedIn: false } },
            { new: true }
        );

        if (!user) {
            // Handle if the user is not found
            console.error("User not found for session ID:", sessionId);
        }
    } catch (error) {
        // Handle any error during the database update
        console.error("Error invalidating session:", error);
    }
}

// Function to send push notifications
const generateUserTag = async (count) => {
    console.log(count);
    // Generate a unique identifier (e.g., using uuid or a custom function)
    const tag = `betfundr${count + 1}`;

    return tag;
};

// Call the function to send the notification
generateUserTag();

function generateUniqueSessionId() {
    return uuidv4();
}

module.exports = router;

function generateUniqueShortUuid(length) {
    const timestamp = Date.now().toString(36); // Convert current timestamp to a base-36 string
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomString = '';
    for (let i = 0; i < length - timestamp.length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);
        randomString += chars[randomIndex];
    }
    return timestamp + randomString;
}

function calculatePercentage(amount) {
    const threePercent = amount * 0.03;
    const thirtythreePercentOfThreePercent = threePercent * 0.33;
    return thirtythreePercentOfThreePercent;
}
