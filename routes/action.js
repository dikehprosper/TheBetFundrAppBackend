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
const newUuid = uuidv4();
const date = new Date();

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

      // Sort the transaction history array by registrationDateTime in descending order
      user.transactionHistory.sort(
        (a, b) =>
          new Date(b.registrationDateTime) - new Date(a.registrationDateTime)
      );

      // Slice the array to get the most recent 20 transactions
      const recentTransactions = user.transactionHistory.slice(0, 20);

      // Return a JSON response with the transaction status
      transactionInProgress = false;
      res
        .status(200)
        .json({
          success: true,
          message: "transaction generated successfully",
          recentTransactions,
          userTransaction,
        });
    }

    if (bonusBalance !== null) {
      if (bonusBalance >= amount) {
        const updatedBonusBalance = bonusBalance - amount;

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
        updatedAmount = amount - bonusBalance;

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
        const apiUrl1 = `${
          process.env.SECONDAPIURL1
        }${network[0].toLowerCase()}`;
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
          bonusBalance: bonusBalance,
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
          bonusBalance: bonusBalance,
          paymentConfirmation: "Pending",
        };
        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        if (!user.supplementaryBetId.includes(betId)) {
          user.supplementaryBetId.push(betId);
        }
        await user.save();

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
          bonusBalance: bonusBalance,
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
        // Sort the transaction history array by registrationDateTime in descending order
        user.transactionHistory.sort(
          (a, b) =>
            new Date(b.registrationDateTime) - new Date(a.registrationDateTime)
        );

        // Slice the array to get the most recent 20 transactions
        const recentTransactions = user.transactionHistory.slice(0, 20);
        // Return a JSON response with the transaction status
        transactionInProgress = false;
        res
          .status(200)
          .json({
            success: true,
            message: "transaction generated successfully",
            recentTransactions,
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
    console.log(id, "id");

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

      // Sort the transaction history array by registrationDateTime in descending order
      user.transactionHistory.sort(
        (a, b) =>
          new Date(b.registrationDateTime) - new Date(a.registrationDateTime)
      );

      // Slice the array to get the most recent 20 transactions
      const recentTransactions = user.transactionHistory.slice(0, 20);

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

module.exports = router;

// _id: res.data.data._id,
//     betId: res.data.data.betID[0],
//     momoName: res.data.data.fullname,
//     momoNumber: res.data.data.number,
//     fullname: res.data.data.fullname,
//     fedapayId: res.data.data.fedapayId,
//     email: res.data.data.email,
