/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const SubAdminUser = require("../models/subadmins");
const AdminUser = require("../models/admin");
const QrCodeDeposits = require("../models/generateQrCode");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();
const { FedaPay, Transaction, Customer } = require("fedapay");
// add the current transaction to the user

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

router.post("/deposit", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;
    const { email, betId, amount, momoNumber, network, service, bonusBalance } =
      req.body;
    console.log(bonusBalance);
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

      // Find the subadmin user by cashdeskId
      const adminUser = await SubAdminUser.find({
        isSubAdminDeposits: true,
        isOutOfFunds: false,
      });
      if (!adminUser || adminUser.length === 0) {
        transactionInProgress = false;
        return res
          .status(503)
          .json({ success: 503, message: "no subadmin user", status: 503 });
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

      // calculate the percentage of amount
      const deductionPercentage = 1.8;
      const deductionAmount = (deductionPercentage / 100) * updatedAmount;

      // Calculate the new amount after deduction and round to the nearest whole number
      const newAmount = Math.round(updatedAmount - deductionAmount);

      FedaPay.setApiKey(process.env.FEDAPAY_KEY1);
      FedaPay.setEnvironment(process.env.ENVIRONMENT1);

      // Change number if originally saved number is different from number sent in
      if (momoNumber !== user.number) {
        console.log("phone number wasn't the original or has to be edited");
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${momoNumber}`,
              country: "BJ",
            },
          }),
        });
        console.log(response, "response");
      }

      // Generate token and Create the transaction on Fedapay
      const transaction = await Transaction.create({
        description: "Description",
        amount: newAmount,
        callback_url: `${process.env.DOMAIN}/payments`,
        currency: {
          iso: "XOF",
        },
        customer: {
          email: email,
        },
      });

      const token = await transaction.generateToken();
      const apiUrl1 = `${process.env.SECONDAPIURL1}${network}`;
      const apiKey1 = process.env.FEDAPAY_KEY1;

      const response1 = await fetch(apiUrl1, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token.token,
        }),
      });
      console.log(response1);

      if (response1.status !== 200) {
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response2 = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${user.number}`,
              country: "BJ",
            },
          }),
        });
        transactionInProgress = false;
        return res
          .status(505)
          .json({
            success: 505,
            message: "Unable to initiate transaction",
            status: 505,
          });
      }

      const date = new Date();
      const newUuid = uuidv4();
      user.pendingDeposit.push({
        fedapayTransactionId: transaction.id,
        transactionId: newUuid,
        createdAt: date,
        status: "Pending",
        amount: amount,
        totalAmount: amount,
        betId: betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        service: service,
        paymentConfirmation: "Pending",
      });

      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        amount: amount,
        totalAmount: amount,
        betId: betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        fundingType: "deposits",
        fedapayTransactionId: transaction.id,
        identifierId: newUuid,
        service: service,
        paymentConfirmation: "Pending",
      };
      user.transactionHistory.push(userTransaction);

      admin.transactionHistory.push({
        userid: user._id,
        status: "Pending",
        registrationDateTime: date,
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
        paymentConfirmation: "Pending",
        fedapayTransactionId: transaction.id,
      });

      if (!user.supplementaryBetId.includes(betId)) {
        user.supplementaryBetId.push(betId);
      }

      await admin.save();
      await user.save();

      // Change number back to original
      if (momoNumber !== user.number) {
        console.log("phone number wasn't the original and has to be edited");
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response2 = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${user.number}`,
              country: "BJ",
            },
          }),
        });
        console.log(response2);
      }

      // Return a JSON response with the transaction status
      transactionInProgress = false;
      res
        .status(200)
        .json({
          success: true,
          message: "transaction generated successfully",
          userTransaction,
        });
    }

    if (bonusBalance !== null) {
      if (bonusBalance >= amount) {
        // Uncomment below code to fetch user and perform additional checks if required
        const user = await User.findOne({ email });
        if (user.bonusBalance < amount) {
          return res
            .status(506)
            .json({
              success: 506,
              message: "wallet balance not sufficient",
              status: 506,
            });
        }
        const updatedBonusBalance = user.bonusBalance - amount;
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
            .json({
              success: 502,
              message: "User is deactivated",
              status: 502,
            });
        }
        // Find the subadmin user by cashdeskId
        const adminUser = await SubAdminUser.find({
          isSubAdminDeposits: true,
          isOutOfFunds: false,
        });
        if (!adminUser || adminUser.length === 0) {
          transactionInProgress = false;
          return res
            .status(503)
            .json({ success: 503, message: "no subadmin user", status: 503 });
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
        const newUuid = uuidv4();
        user.pendingDeposit.push({
          transactionId: newUuid,
          createdAt: date,
          status: "Pending",
          amount: 0,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          service: service,
          bonusBalance: amount,
          paymentConfirmation: "Pending",
          totalAmount: amount,
        });

        const userTransaction = {
          status: "Pending",
          registrationDateTime: date,
          amount: 0,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          service: service,
          bonusBalance: amount,
          totalAmount: amount,
          paymentConfirmation: "Pending",
        };
        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        user.bonusBalance = updatedBonusBalance;

        if (!user.supplementaryBetId.includes(betId)) {
          user.supplementaryBetId.push(betId);
        }
        await user.save();
        const newUserBonus = user.bonusBalance;
        admin.transactionHistory.push({
          userid: user._id,
          status: "Pending",
          registrationDateTime: date,
          amount: 0,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: "none",
          service: service,
          paymentConfirmation: "Pending",
          bonusBalance: amount,
        });

        await admin.save();

        // Return a JSON response with the transaction status
        transactionInProgress = false;
        res
          .status(200)
          .json({
            success: true,
            message: "transaction generated successfully",
            newUserBonus,
            userTransaction,
          });
      }

      if (bonusBalance < amount) {
        console.log(updatedAmount, "lllll"); // Uncomment below code to fetch user and perform additional checks if required
        const user = await User.findOne({ email });

        updatedAmount = amount - user.bonusBalance;

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
            .json({
              success: 502,
              message: "User is deactivated",
              status: 502,
            });
        }

        // Find the subadmin user by cashdeskId
        const adminUser = await SubAdminUser.find({
          isSubAdminDeposits: true,
          isOutOfFunds: false,
        });
        if (!adminUser || adminUser.length === 0) {
          transactionInProgress = false;
          return res
            .status(503)
            .json({ success: 503, message: "no subadmin user", status: 503 });
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

        // calculate the percentage of amount
        const deductionPercentage = 1.8;
        const deductionAmount = (deductionPercentage / 100) * updatedAmount;

        // Calculate the new amount after deduction and round to the nearest whole number
        const newAmount = Math.round(updatedAmount - deductionAmount);

        FedaPay.setApiKey(process.env.FEDAPAY_KEY1);
        FedaPay.setEnvironment(process.env.ENVIRONMENT1);

        // Change number if originally saved number is different from number sent in
        if (momoNumber !== user.number) {
          console.log("phone number wasn't the original or has to be edited");
          const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
          const apiKey = process.env.FEDAPAY_KEY1;

          const response = await fetch(apiUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // firstname: momoName.split(" ")[0],
              // lastname: momoName.split(" ")[1],
              email: email,
              phone_number: {
                number: `+229${momoNumber}`,
                country: "BJ",
              },
            }),
          });
          console.log(response, "response");
        }

        // Generate token and Create the transaction on Fedapay
        const transaction = await Transaction.create({
          description: "Description",
          amount: newAmount,
          callback_url: `${process.env.DOMAIN}/payments`,
          currency: {
            iso: "XOF",
          },
          customer: {
            email: email,
          },
        });

        const token = await transaction.generateToken();
        const apiUrl1 = `${process.env.SECONDAPIURL1}${network}`;
        const apiKey1 = process.env.FEDAPAY_KEY1;

        const response1 = await fetch(apiUrl1, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey1}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: token.token,
          }),
        });
        console.log(response1);

        if (response1.status !== 200) {
          const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
          const apiKey = process.env.FEDAPAY_KEY1;

          const response2 = await fetch(apiUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // firstname: momoName.split(" ")[0],
              // lastname: momoName.split(" ")[1],
              email: email,
              phone_number: {
                number: `+229${user.number}`,
                country: "BJ",
              },
            }),
          });
          transactionInProgress = false;
          return res
            .status(505)
            .json({
              success: 505,
              message: "Unable to initiate transaction",
              status: 505,
            });
        }
        const date = new Date();
        const newUuid = uuidv4();
        user.pendingDeposit.push({
          fedapayTransactionId: transaction.id,
          transactionId: newUuid,
          createdAt: date,
          status: "Pending",
          amount: updatedAmount,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          service: service,
          bonusBalance: user.bonusBalance,
          paymentConfirmation: "Pending",
        });

        const userTransaction = {
          status: "Pending",
          registrationDateTime: date,
          amount: updatedAmount,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          fedapayTransactionId: transaction.id,
          identifierId: newUuid,
          service: service,
          bonusBalance: user.bonusBalance,
          paymentConfirmation: "Pending",
        };
        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        user.bonusBalance = 0;

        if (!user.supplementaryBetId.includes(betId)) {
          user.supplementaryBetId.push(betId);
        }
        await user.save();
        const newUserBonus = user.bonusBalance;
        admin.transactionHistory.push({
          userid: user._id,
          status: "Pending",
          registrationDateTime: date,
          amount: updatedAmount,
          betId: betId,
          totalAmount: amount,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: "none",
          service: service,
          paymentConfirmation: "Pending",
          bonusBalance: user.bonusBalance,
          fedapayTransactionId: transaction.id,
        });

        await admin.save();

        // Change number back to original
        if (momoNumber !== user.number) {
          console.log("phone number wasn't the original and has to be edited");
          const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
          const apiKey = process.env.FEDAPAY_KEY1;

          const response2 = await fetch(apiUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              // firstname: momoName.split(" ")[0],
              // lastname: momoName.split(" ")[1],
              email: email,
              phone_number: {
                number: `+229${user.number}`,
                country: "BJ",
              },
            }),
          });
          console.log(response2);
        }

        transactionInProgress = false;
        res
          .status(200)
          .json({
            success: true,
            message: "transaction generated successfully",
            newUserBonus,
            userTransaction,
          });
      }
    }
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request for deposit:", error);
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

      // Find the subadmin user by cashdeskId
      const adminUser = await SubAdminUser.find({
        isSubAdminDeposits: true,
        isOutOfFunds: false,
      });
      if (!adminUser || adminUser.length === 0) {
        transactionInProgress = false;
        return res
          .status(503)
          .json({ success: 503, message: "no subadmin user", status: 503 });
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

      // calculate the percentage of amount
      const deductionPercentage = 1.8;
      const deductionAmount = (deductionPercentage / 100) * updatedAmount;

      // Calculate the new amount after deduction and round to the nearest whole number
      const newAmount = Math.round(updatedAmount - deductionAmount);

      FedaPay.setApiKey(process.env.FEDAPAY_KEY1);
      FedaPay.setEnvironment(process.env.ENVIRONMENT1);

      // Change number if originally saved number is different from number sent in
      if (momoNumber !== user.number) {
        console.log("phone number wasn't the original or has to be edited");
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${momoNumber}`,
              country: "BJ",
            },
          }),
        });
        console.log(response, "response");
      }

      // Generate token and Create the transaction on Fedapay
      const transaction = await Transaction.create({
        description: "Description",
        amount: newAmount,
        callback_url: `${process.env.DOMAIN}/payments`,
        currency: {
          iso: "XOF",
        },
        customer: {
          email: email,
        },
      });

      const token = await transaction.generateToken();
      const apiUrl1 = `${process.env.SECONDAPIURL1}${network}`;
      const apiKey1 = process.env.FEDAPAY_KEY1;

      const response1 = await fetch(apiUrl1, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey1}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token.token,
        }),
      });
      console.log(response1, "response1");

      if (response1.status !== 200) {
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response2 = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${user.number}`,
              country: "BJ",
            },
          }),
        });
        transactionInProgress = false;
        return res
          .status(505)
          .json({
            success: 505,
            message: "Unable to initiate transaction",
            status: 505,
          });
      }

      // Change number back to original
      if (momoNumber !== user.number) {
        console.log("phone number wasn't the original and has to be edited");
        const apiUrl = `${process.env.APIURL1}${user.fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;

        const response2 = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // firstname: momoName.split(" ")[0],
            // lastname: momoName.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${user.number}`,
              country: "BJ",
            },
          }),
        });
        console.log(response2);
      }

      const date = new Date();
      const newUuid = uuidv4();

      user.pendingDeposit.push({
        fedapayTransactionId: transaction.id,
        transactionId: newUuid,
        createdAt: date,
        status: "Pending",
        amount: qrCodeData.amount,
        totalAmount: qrCodeData.amount,
        betId: qrCodeData.betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        service: qrCodeData.service,
        paymentConfirmation: "Pending",
        authenticatedDeposit: false,
        QrCodeDepositsId: qrCodeData._id,
      });

      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        amount: qrCodeData.amount,
        totalAmount: qrCodeData.amount,
        betId: qrCodeData.betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        fundingType: "deposits",
        fedapayTransactionId: transaction.id,
        identifierId: newUuid,
        service: qrCodeData.service,
        paymentConfirmation: "Pending",
        authenticatedDeposit: false,
        QrCodeDepositsId: qrCodeData._id,
      };
      user.transactionHistory.push(userTransaction);

      admin.transactionHistory.push({
        userid: user._id,
        status: "Pending",
        registrationDateTime: date,
        amount: qrCodeData.amount,
        totalAmount: qrCodeData.amount,
        betId: qrCodeData.betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        fundingType: "deposits",
        identifierId: newUuid,
        userEmail: email,
        subadminEmail: "none",
        service: qrCodeData.service,
        paymentConfirmation: "Pending",
        fedapayTransactionId: transaction.id,
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

router.post("/walletdeposit", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;
    const { email, betId, amount, momoNumber, network, service, bonusBalance } =
      req.body;

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

    // Find the subadmin user by cashdeskId
    const adminUserss = await SubAdminUser.find({
      isSubAdminDeposits: true,
      isOutOfFunds: false,
    });
    if (!adminUserss || adminUserss.length === 0) {
      transactionInProgress = false;
      return res
        .status(503)
        .json({ success: 503, message: "no subadmin user", status: 503 });
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

    const getBalance = user.bonusBalance;

    if (getBalance < amount) {
      transactionInProgress = false;
      return res
        .status(506)
        .json({
          success: 506,
          message: "wallet balance not sufficient",
          status: 506,
        });
    }
    const newBalance = getBalance - amount;
    user.bonusBalance = newBalance;
    await user.save();

    const date = new Date();
    const newUuid = uuidv4();
    user.pendingDeposit.push({
      transactionId: newUuid,
      createdAt: date,
      status: "Pending",
      amount: 0,
      betId: betId,
      // momoName: momoName,
      momoNumber: momoNumber,
      service: service,
      bonusBalance: amount,
      paymentConfirmation: "Pending",
      totalAmount: amount,
    });

    const userTransaction = {
      status: "Pending",
      registrationDateTime: date,
      amount: 0,
      betId: betId,
      // momoName: momoName,
      momoNumber: momoNumber,
      fundingType: "deposits",
      identifierId: newUuid,
      service: service,
      bonusBalance: amount,
      totalAmount: amount,
      paymentConfirmation: "Pending",
    };
    user.transactionHistory.push(userTransaction);
    user.bonus.push(userTransaction);

    if (!user.supplementaryBetId.includes(betId)) {
      user.supplementaryBetId.push(betId);
    }
    await user.save();

    const subadminTransaction = {
      userid: user._id,
      status: "Pending",
      registrationDateTime: date,
      amount: amount,
      betId: betId,
      momoNumber: momoNumber,
      fundingType: "deposits",
      identifierId: newUuid,
      paymentConfirmation: "Successful",
    };

    //  UPDATE TO ONE SUBADMINS
    const adminUsers = await SubAdminUser.find({
      isSubAdminDeposits: true,
    });
    const adminUser = await SubAdminUser.find({
      isSubAdminDeposits: true,
      isOutOfFunds: false,
    });
    console.log(adminUser, "kkkkk");

    if (!adminUser || adminUser.length === 0) {
      adminUsers[0].transactionHistory.push(subadminTransaction);
      admin.transactionHistory.push({
        userid: user._id,
        status: "Pending",
        registrationDateTime: date,
        amount: 0,
        totalAmount: amount,
        betId: betId,
        // momoName: momoName,
        momoNumber: momoNumber,
        fundingType: "deposits",
        identifierId: newUuid,
        userEmail: email,
        subadminEmail: adminUsers[0].email,
        service: service,
        paymentConfirmation: "Successful",
        bonusBalance: amount,
      });

      await adminUser.save();
      await admin.save();
    } else {
      // Example usage: Get the index of the subadmin with current: true
      let currentSubadminIndex = -1;

      for (let i = 0; i < adminUser.length; i++) {
        if (adminUser[i].current === true) {
          currentSubadminIndex = i;
          break;
        }
      }

      // Find the subadmin that is currently receiving requests
      const currentSubadmin = adminUser.find(
        (subadmin) => subadmin.current === true
      );
      console.log(currentSubadmin, "kkkkk");
      // Check if the request count for the current subadmin is divisible by 10
      if (currentSubadmin && currentSubadmin.currentCount === 5) {
        // Mark the current subadmin as not 'current'
        currentSubadmin.current = false;
        currentSubadmin.currentCount = 0;
        let nextCurrentSubadminIndex =
          (currentSubadminIndex + 1) % adminUser.length;

        let nextSubadmin = adminUser[nextCurrentSubadminIndex]
          ? adminUser[nextCurrentSubadminIndex]
          : adminUser[0];

        // Mark the next subadmin as 'current'
        nextSubadmin.current = true;
        const updatedCount = nextSubadmin.currentCount + 1;
        nextSubadmin.currentCount = updatedCount;
        nextSubadmin.transactionHistory.push(subadminTransaction);

        admin.transactionHistory.push({
          userid: user._id,
          status: "Pending",
          registrationDateTime: date,
          amount: 0,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: nextSubadmin.email,
          service: service,
          paymentConfirmation: "Successful",
          bonusBalance: amount,
        });
        // Save changes to the database for both the current and next subadmin
        await Promise.all([
          currentSubadmin.save(),
          nextSubadmin.save(),
          admin.save(),
        ]);
      } else {
        admin.transactionHistory.push({
          userid: user._id,
          status: "Pending",
          registrationDateTime: date,
          amount: 0,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: currentSubadmin.email,
          service: service,
          paymentConfirmation: "Successful",
          bonusBalance: amount,
        });

        currentSubadmin.transactionHistory.push(subadminTransaction);
        const updatedCount = currentSubadmin.currentCount + 1;
        currentSubadmin.currentCount = updatedCount;
        await currentSubadmin.save();
        await admin.save();
      }
    }

    await user.save();

    const newUserBonus = user.bonusBalance;
    // Return a JSON response with the transaction status
    transactionInProgress = false;
    res
      .status(200)
      .json({
        success: true,
        message: "transaction generated successfully",
        newUserBonus,
        userTransaction,
      });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request for deposit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/withdrawal", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;

    const {
      _id,
      betId,
      withdrawalCode,
      amount,
      momoNumber,
      service,
      bonusBalance,
    } = req.body;

    if (bonusBalance) {
      const admin = await AdminUser.findOne({ isAdmin: true });

      if (admin.isWithdrawalsOpen === false) {
        transactionInProgress = false;
        return res
          .status(405)
          .json({
            success: 405,
            message: "We are currently under maintainance",
            status: 405,
          });
      }

      // Check if the User already exists
      const user = await User.findOne({ _id });
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
      // Find the subadmin user by cashdeskId
      const adminUser = await SubAdminUser.find({
        isSubAdminWithdrawals: true,
        isOutOfFunds: false,
      });
      if (!adminUser || adminUser.length === 0) {
        transactionInProgress = false;
        return res
          .status(402)
          .json({
            success: 402,
            message: "No available Subadmin User",
            status: 402,
          });
      }

      const getBalance = user.bonusBalance;
      if (getBalance < amount) {
        transactionInProgress = false;
        return res
          .status(506)
          .json({
            success: 506,
            message: "wallet balance not sufficient",
            status: 506,
          });
      }
      const newBalance = getBalance - amount;
      user.bonusBalance = newBalance;
      await user.save();

      const newUuid = uuidv4();
      const date = new Date();

      // Create a new transaction history entry for the user
      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        amount: 0,
        totalAmount: amount,
        withdrawalCode,
        betId,
        service,
        fundingType: "withdrawals",
        identifierId: newUuid,
        bonusBalance: amount,
        momoNumber,
      };

      // Add the current pending transaction to the user

      const subadminTransaction = {
        userid: _id,
        status: "Pending",
        registrationDateTime: date,
        withdrawalCode,
        amount: amount,
        betId,
        fundingType: "withdrawals",
        identifierId: newUuid,
        service,
        momoNumber,
      };

      const newUserBonus = user.bonusBalance;
      // Example usage: Get the index of the subadmin with current: true
      let currentSubadminIndex = -1;

      for (let i = 0; i < adminUser.length; i++) {
        if (adminUser[i].current === true) {
          currentSubadminIndex = i;
          break;
        }
      }

      // Find the subadmin that is currently receiving requests
      const currentSubadmin = adminUser.find(
        (subadmin) => subadmin.current === true
      );

      // Check if the request count for the current subadmin is divisible by 10
      if (currentSubadmin && currentSubadmin.currentCount === 5) {
        // Mark the current subadmin as not 'current'
        currentSubadmin.current = false;
        currentSubadmin.currentCount = 0;
        let nextCurrentSubadminIndex =
          (currentSubadminIndex + 1) % adminUser.length;

        let nextSubadmin = adminUser[nextCurrentSubadminIndex]
          ? adminUser[nextCurrentSubadminIndex]
          : adminUser[0];

        // Mark the next subadmin as 'current'
        nextSubadmin.current = true;
        const updatedCount = nextSubadmin.currentCount + 1;
        nextSubadmin.currentCount = updatedCount;
        nextSubadmin.transactionHistory.push(subadminTransaction);

        const adminTransaction = {
          userid: _id,
          status: "Pending",
          registrationDateTime: date,
          withdrawalCode,
          amount: 0,
          totalAmount: amount,
          bonusBalance: amount,
          betId,
          fundingType: "withdrawals",
          identifierId: newUuid,
          service,
          momoNumber,
          userEmail: user.email,
          subadminEmail: nextSubadmin.email,
        };
        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        admin.transactionHistory.push(adminTransaction);

        // Save changes to the database for both the current and next subadmin
        await Promise.all([
          currentSubadmin.save(),
          nextSubadmin.save(),
          admin.save(),
          user.save(),
        ]);

        transactionInProgress = false;
        return res.status(201).json({
          message: "History added",
          success: true,
          userTransaction,
          newUserBonus,
        });
      } else {
        currentSubadmin.transactionHistory.push(subadminTransaction);
        const updatedCount = currentSubadmin.currentCount + 1;
        currentSubadmin.currentCount = updatedCount;

        const admin = await AdminUser.findOne({
          isAdmin: true,
        });

        const adminTransaction = {
          userid: _id,
          status: "Pending",
          registrationDateTime: date,
          withdrawalCode,
          amount: 0,
          bonusBalance: amount,
          betId,
          fundingType: "withdrawals",
          identifierId: newUuid,
          service,
          totalAmount: amount,
          momoNumber,
          userEmail: user.email,
          subadminEmail: currentSubadmin.email,
        };
        admin.transactionHistory.push(adminTransaction);
        user.transactionHistory.push(userTransaction);
        await user.save();
        await admin.save();
        await currentSubadmin.save();
        // Return the added transaction details in the response
        transactionInProgress = false;
        return res.status(201).json({
          message: "History added",
          success: true,
          userTransaction,
          newUserBonus,
        });
      }
    } else {
      const admin = await AdminUser.findOne({ isAdmin: true });

      if (admin.isWithdrawalsOpen === false) {
        transactionInProgress = false;
        return res
          .status(405)
          .json({
            success: 405,
            message: "We are currently under maintainance",
            status: 405,
          });
      }

      // Check if the User already exists
      const user = await User.findOne({ _id });
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

      const newUuid = uuidv4();
      const date = new Date();

      // Create a new transaction history entry for the user
      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        amount,
        totalAmount: amount,
        withdrawalCode,
        betId,
        service,
        momoNumber,
        fundingType: "withdrawals",
        identifierId: newUuid,
      };

      // Add the current pending transaction to the user

      // Find the subadmin user by cashdeskId
      const adminUser = await SubAdminUser.find({
        isSubAdminWithdrawals: true,
        isOutOfFunds: false,
      });
      if (!adminUser || adminUser.length === 0) {
        transactionInProgress = false;
        return res
          .status(402)
          .json({
            success: 402,
            message: "No available Subadmin User",
            status: 402,
          });
      }

      const subadminTransaction = {
        userid: _id,
        status: "Pending",
        registrationDateTime: date,
        withdrawalCode,
        amount,
        totalAmount: amount,
        betId,
        fundingType: "withdrawals",
        identifierId: newUuid,
        service,
        momoNumber,
      };

      // Example usage: Get the index of the subadmin with current: true
      let currentSubadminIndex = -1;

      for (let i = 0; i < adminUser.length; i++) {
        if (adminUser[i].current === true) {
          currentSubadminIndex = i;
          break;
        }
      }

      // Find the subadmin that is currently receiving requests
      const currentSubadmin = adminUser.find(
        (subadmin) => subadmin.current === true
      );

      console.log(currentSubadmin, "currentSubadmin");
      // Check if the request count for the current subadmin is divisible by 10
      if (currentSubadmin && currentSubadmin.currentCount === 5) {
        // Mark the current subadmin as not 'current'
        currentSubadmin.current = false;
        currentSubadmin.currentCount = 0;
        let nextCurrentSubadminIndex =
          (currentSubadminIndex + 1) % adminUser.length;

        let nextSubadmin = adminUser[nextCurrentSubadminIndex]
          ? adminUser[nextCurrentSubadminIndex]
          : adminUser[0];

        // Mark the next subadmin as 'current'
        nextSubadmin.current = true;
        const updatedCount = nextSubadmin.currentCount + 1;
        nextSubadmin.currentCount = updatedCount;
        nextSubadmin.transactionHistory.push(subadminTransaction);

        const adminTransaction = {
          userid: _id,
          status: "Pending",
          registrationDateTime: date,
          withdrawalCode,
          amount,
          totalAmount: amount,
          betId,
          fundingType: "withdrawals",
          identifierId: newUuid,
          service,
          momoNumber,
          userEmail: user.email,
          subadminEmail: nextSubadmin.email,
        };
        user.transactionHistory.push(userTransaction);
        admin.transactionHistory.push(adminTransaction);

        // Save changes to the database for both the current and next subadmin
        await Promise.all([
          currentSubadmin.save(),
          nextSubadmin.save(),
          admin.save(),
          user.save(),
        ]);

        transactionInProgress = false;
        return res.status(201).json({
          message: "History added",
          success: true,
          userTransaction,
        });
      } else {
        currentSubadmin.transactionHistory.push(subadminTransaction);
        const updatedCount = currentSubadmin.currentCount + 1;
        currentSubadmin.currentCount = updatedCount;

        const admin = await AdminUser.findOne({
          isAdmin: true,
        });

        const adminTransaction = {
          userid: _id,
          status: "Pending",
          registrationDateTime: date,
          withdrawalCode,
          amount,
          betId,
          fundingType: "withdrawals",
          identifierId: newUuid,
          service,
          totalAmount: amount,
          momoNumber,
          userEmail: user.email,
          subadminEmail: currentSubadmin.email,
        };
        admin.transactionHistory.push(adminTransaction);
        user.transactionHistory.push(userTransaction);
        await user.save();
        await admin.save();
        await currentSubadmin.save();
        // Return the added transaction details in the response
        transactionInProgress = false;
        return res.status(201).json({
          message: "History added",
          success: true,
          userTransaction,
        });
      }
    }
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request for deposit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/searchSendingPage", async (req, res) => {
  let transactionInProgress = false;

  try {
    transactionInProgress = true;

    const { _id, value } = req.body;
    console.log(_id);

    if (!value) {
      transactionInProgress = false;
      return res
        .status(400)
        .json({
          success: false,
          message: "Search value cannot be empty",
          status: 400,
        });
    }

    const admin = await AdminUser.findOne({ isAdmin: true });

    if (!admin) {
      transactionInProgress = false;
      return res
        .status(500)
        .json({ success: 500, message: "Admin not found", status: 500 });
    }

    if (!admin.isWithdrawalsOpen) {
      transactionInProgress = false;
      return res
        .status(405)
        .json({
          success: 405,
          message: "We are currently under maintenance",
          status: 405,
        });
    }

    const user = await User.findOne({ _id });
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

    const users = await User.find({});
    const cleanedValue = value.startsWith("@") ? value.slice(1) : value;
    console.log(cleanedValue, "jjj");
    const lowerCaseValue = cleanedValue.toLowerCase();

    const search = users
      .filter((user) => user.email.toLowerCase().startsWith(lowerCaseValue))
      .map((user) => ({
        _id: user._id,
        tag: user.tag,
        email: user.email,
        fullname: user.fullname,
        image: user.image,
      }));

    if (search.length > 0) {
      transactionInProgress = false;
      return res
        .status(200)
        .json({
          success: true,
          message: "User(s) found",
          status: true,
          search,
        });
    }

    const search2 = users
      .filter((user) => user?.tag?.toLowerCase().startsWith(lowerCaseValue))
      .map((user) => ({
        _id: user._id,
        tag: user.tag,
        email: user.email,
        fullname: user.fullname,
        image: user.image,
      }));

    if (search2.length > 0) {
      const search = search2;
      transactionInProgress = false;
      return res
        .status(200)
        .json({
          success: true,
          message: "User(s) found",
          status: true,
          search,
        });
    }

    transactionInProgress = false;
    return res
      .status(404)
      .json({ success: 404, message: "No User found", status: 404 });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/walletSend", async (req, res) => {
  let transactionInProgress = false;

  try {
    transactionInProgress = true;

    const { id, recipientId, amount } = req.body;

    const admin = await AdminUser.findOne({ isAdmin: true });

    if (!admin) {
      transactionInProgress = false;
      return res
        .status(500)
        .json({ success: 500, message: "Admin not found", status: 500 });
    }

    const user = await User.findOne({ _id: id });
    const recipient = await User.findOne({ _id: recipientId });

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

    if (!recipient) {
      transactionInProgress = false;
      return res
        .status(402)
        .json({ success: 402, message: "receipient not found", status: 402 });
    }

    if (!recipient.isActivated) {
      transactionInProgress = false;
      return res
        .status(503)
        .json({
          success: 503,
          message: "receipient is deactivated",
          status: 503,
        });
    }

    const getWalletBalanceForSender = user.bonusBalance;
    if (getWalletBalanceForSender < amount) {
      transactionInProgress = false;
      return res
        .status(504)
        .json({ success: 504, message: "insufficient balance", status: 504 });
    }

    const newBalance = getWalletBalanceForSender - amount;
    const newBalanceForRecipient = recipient.bonusBalance + amount;
    user.bonusBalance = newBalance;
    recipient.bonusBalance = newBalanceForRecipient;

    console.log(recipient, "recipient");

    const date = new Date();
    const newUuid = uuidv4();

    const userTransaction = {
      recipientid: recipient._id,
      status: "Successful",
      registrationDateTime: date,
      amount: amount,
      totalAmount: amount,
      fundingType: "send",
      identifierId: newUuid,
      paymentConfirmation: "Successful",
      recipientTag: recipient.tag,
      recipientName: recipient.fullname,
      bonusBalance: amount,
    };

    user.transactionHistory.push(userTransaction);
    recipient.transactionHistory.push({
      senderName: user.fullname,
      recipientid: recipient._id,
      status: "Successful",
      registrationDateTime: date,
      amount: amount,
      totalAmount: amount,
      fundingType: "receive",
      identifierId: newUuid,
      paymentConfirmation: "Successful",
      recipientTag: recipient.tag,
      recipientName: recipient.fullname,
      bonusBalance: amount,
    });

    admin.transactionHistory.push({
      senderName: user.fullname,
      recipientName: recipient.fullname,
      recipientTag: recipient.tag,
      userid: user._id,
      recipientid: recipient._id,
      status: "Successful",
      registrationDateTime: date,
      amount: amount,
      totalAmount: amount,
      // momoName: momoName,
      fundingType: "send",
      identifierId: newUuid,
      paymentConfirmation: "Successful",
      bonusBalance: amount,
    });
    console.log("user");

    await recipient.save();
    await user.save();
    await admin.save();

    const updatedBalance = user.bonusBalance;
    transactionInProgress = false;
    return res
      .status(201)
      .json({
        success: true,
        message: "Successful",
        status: 201,
        updatedBalance,
        userTransaction,
      });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

// _id: res.data.data._id,
//     betId: res.data.data.betID[0],
//     momoName: res.data.data.fullname,
//     momoNumber: res.data.data.number,
//     fullname: res.data.data.fullname,
//     fedapayId: res.data.data.fedapayId,
//     email: res.data.data.email,
