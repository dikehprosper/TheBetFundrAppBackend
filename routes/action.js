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
const { makePaymentRequest } = require("../helpers/makePaymentRequest");
const { validateDepositRequest } = require("../helpers/checkVerificationForInput");
const { validateDepositRequest2 } = require("../helpers/checkVerificationForInput");
const { rechargeAccount, checkBalance, withdrawFromAccount } = require('./mobcash');
const SendEmail = require("../utils/mailer");
const path = require('path');
const fs = require('fs');
const bcryptjs = require("bcryptjs");
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




router.post("/depositWithFedapay", checkOngoingTransaction, async (req, res) => {
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
        // const adminUser = await SubAdminUser.find({
        //   isSubAdminDeposits: true,
        //   isOutOfFunds: false,
        // });
        // if (!adminUser || adminUser.length === 0) {
        //   transactionInProgress = false;
        //   return res
        //     .status(503)
        //     .json({ success: 503, message: "no subadmin user", status: 503 });
        // }

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
// router.post("/walletdepositWithSubadmin", checkOngoingTransaction, async (req, res) => {
//   try {
//     transactionInProgress = true;
//     const { email, betId, amount, momoNumber, network, service, bonusBalance } =
//       req.body;

//     // Uncomment below code to fetch user and perform additional checks if required
//     const user = await User.findOne({ email });
//     if (!user) {
//       transactionInProgress = false;
//       return res
//         .status(401)
//         .json({ success: 401, message: "User not found", status: 401 });
//     }
//     if (!user.isActivated) {
//       transactionInProgress = false;
//       return res
//         .status(502)
//         .json({ success: 502, message: "User is deactivated", status: 502 });
//     }

//     // Find the subadmin user by cashdeskId
//     const adminUserss = await SubAdminUser.find({
//       isSubAdminDeposits: true,
//       isOutOfFunds: false,
//     });
//     if (!adminUserss || adminUserss.length === 0) {
//       transactionInProgress = false;
//       return res
//         .status(503)
//         .json({ success: 503, message: "no subadmin user", status: 503 });
//     }

//     // Find available admin
//     const admin = await AdminUser.findOne({ isAdmin: true });
//     if (admin.isDepositsOpen === false) {
//       transactionInProgress = false;
//       return res
//         .status(504)
//         .json({
//           success: 504,
//           message: "currently under maintainance",
//           status: 504,
//         });
//     }

//     const getBalance = user.bonusBalance;

//     if (getBalance < amount) {
//       transactionInProgress = false;
//       return res
//         .status(506)
//         .json({
//           success: 506,
//           message: "wallet balance not sufficient",
//           status: 506,
//         });
//     }
//     const newBalance = getBalance - amount;
//     user.bonusBalance = newBalance;
//     await user.save();

//     const date = new Date();
//     const newUuid = uuidv4();
//     user.pendingDeposit.push({
//       transactionId: newUuid,
//       createdAt: date,
//       status: "Pending",
//       amount: 0,
//       betId: betId,
//       // momoName: momoName,
//       momoNumber: momoNumber,
//       service: service,
//       bonusBalance: amount,
//       paymentConfirmation: "Pending",
//       totalAmount: amount,
//     });

//     const userTransaction = {
//       status: "Pending",
//       registrationDateTime: date,
//       amount: 0,
//       betId: betId,
//       // momoName: momoName,
//       momoNumber: momoNumber,
//       fundingType: "deposits",
//       identifierId: newUuid,
//       service: service,
//       bonusBalance: amount,
//       totalAmount: amount,
//       paymentConfirmation: "Pending",
//     };
//     user.transactionHistory.push(userTransaction);
//     user.bonus.push(userTransaction);

//     if (!user.supplementaryBetId.includes(betId)) {
//       user.supplementaryBetId.push(betId);
//     }
//     await user.save();

//     const subadminTransaction = {
//       userid: user._id,
//       status: "Pending",
//       registrationDateTime: date,
//       amount: amount,
//       betId: betId,
//       momoNumber: momoNumber,
//       fundingType: "deposits",
//       identifierId: newUuid,
//       paymentConfirmation: "Successful",
//     };

//     //  UPDATE TO ONE SUBADMINS
//     const adminUsers = await SubAdminUser.find({
//       isSubAdminDeposits: true,
//     });
//     const adminUser = await SubAdminUser.find({
//       isSubAdminDeposits: true,
//       isOutOfFunds: false,
//     });
//     console.log(adminUser, "kkkkk");

//     if (!adminUser || adminUser.length === 0) {
//       adminUsers[0].transactionHistory.push(subadminTransaction);
//       admin.transactionHistory.push({
//         userid: user._id,
//         status: "Pending",
//         registrationDateTime: date,
//         amount: 0,
//         totalAmount: amount,
//         betId: betId,
//         // momoName: momoName,
//         momoNumber: momoNumber,
//         fundingType: "deposits",
//         identifierId: newUuid,
//         userEmail: email,
//         subadminEmail: adminUsers[0].email,
//         service: service,
//         paymentConfirmation: "Successful",
//         bonusBalance: amount,
//       });

//       await adminUser.save();
//       await admin.save();
//     } else {
//       // Example usage: Get the index of the subadmin with current: true
//       let currentSubadminIndex = -1;

//       for (let i = 0; i < adminUser.length; i++) {
//         if (adminUser[i].current === true) {
//           currentSubadminIndex = i;
//           break;
//         }
//       }

//       // Find the subadmin that is currently receiving requests
//       const currentSubadmin = adminUser.find(
//         (subadmin) => subadmin.current === true
//       );
//       console.log(currentSubadmin, "kkkkk");
//       // Check if the request count for the current subadmin is divisible by 10
//       if (currentSubadmin && currentSubadmin.currentCount === 5) {
//         // Mark the current subadmin as not 'current'
//         currentSubadmin.current = false;
//         currentSubadmin.currentCount = 0;
//         let nextCurrentSubadminIndex =
//           (currentSubadminIndex + 1) % adminUser.length;

//         let nextSubadmin = adminUser[nextCurrentSubadminIndex]
//           ? adminUser[nextCurrentSubadminIndex]
//           : adminUser[0];

//         // Mark the next subadmin as 'current'
//         nextSubadmin.current = true;
//         const updatedCount = nextSubadmin.currentCount + 1;
//         nextSubadmin.currentCount = updatedCount;
//         nextSubadmin.transactionHistory.push(subadminTransaction);

//         admin.transactionHistory.push({
//           userid: user._id,
//           status: "Pending",
//           registrationDateTime: date,
//           amount: 0,
//           totalAmount: amount,
//           betId: betId,
//           // momoName: momoName,
//           momoNumber: momoNumber,
//           fundingType: "deposits",
//           identifierId: newUuid,
//           userEmail: email,
//           subadminEmail: nextSubadmin.email,
//           service: service,
//           paymentConfirmation: "Successful",
//           bonusBalance: amount,
//         });
//         // Save changes to the database for both the current and next subadmin
//         await Promise.all([
//           currentSubadmin.save(),
//           nextSubadmin.save(),
//           admin.save(),
//         ]);
//       } else {
//         admin.transactionHistory.push({
//           userid: user._id,
//           status: "Pending",
//           registrationDateTime: date,
//           amount: 0,
//           totalAmount: amount,
//           betId: betId,
//           // momoName: momoName,
//           momoNumber: momoNumber,
//           fundingType: "deposits",
//           identifierId: newUuid,
//           userEmail: email,
//           subadminEmail: currentSubadmin.email,
//           service: service,
//           paymentConfirmation: "Successful",
//           bonusBalance: amount,
//         });

//         currentSubadmin.transactionHistory.push(subadminTransaction);
//         const updatedCount = currentSubadmin.currentCount + 1;
//         currentSubadmin.currentCount = updatedCount;
//         await currentSubadmin.save();
//         await admin.save();
//       }
//     }

//     await user.save();

//     const newUserBonus = user.bonusBalance;
//     // Return a JSON response with the transaction status
//     transactionInProgress = false;
//     res
//       .status(200)
//       .json({
//         success: true,
//         message: "transaction generated successfully",
//         newUserBonus,
//         userTransaction,
//       });
//   } catch (error) {
//     transactionInProgress = false;
//     console.error("Error completing the request for deposit:", error);
//     res.status(500).json({ error: "Internal server error" });
//   }
// });

router.post("/deposit", checkOngoingTransaction, async (req, res) => {

  try {
    transactionInProgress = true;
    const { email, betId, amount, momoNumber, network, service, bonusBalance } =
      req.body;

    // Validate the request body
    const errors = validateDepositRequest(req.body);
    if (errors.length > 0) {
      transactionInProgress = false;
      return res.status(400).json({ success: 400, message: "invalid Input", status: 400 });
    }
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

        // console.log('Overall condition:', isRecent);
        return isRecent;
      });

      // if (recentTransaction) {
      //   console.log('Found recent transaction:', recentTransaction);
      // } else {
      //   console.log('No recent transaction found');
      // }

      console.log(recentTransaction, "hcghcghchghv")


      if (recentTransaction !== undefined) {

        console.log(recentTransaction, "yyyyyyyy")
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
          console.error("Failed to send deposit email:", emailError);
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
      console.log("API Response:");
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
            console.error("Failed to send deposit email:", emailError);
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
      // INITIATE MOBCASH TRANSACTION

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
        console.error("Failed to send deposit email:", emailError);
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
        user
      });
    }

    if (bonusBalance !== null) {
      if (bonusBalance >= amount) {
        console.log("done")
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
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
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
        if (recentTransaction !== undefined) {
          transactionInProgress = false;
          const userTransaction = {
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            network: network,
            bonusBalance: amount,
            totalAmount: amount,
            paymentConfirmation: "Failed",
            customErrorCode: 300
          };
          user.transactionHistory.push(userTransaction);
          admin.transactionHistory.push({
            userid: user._id,
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            totalAmount: amount,
            betId: betId,
            network: network,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Failed",
            bonusBalance: amount,
            customErrorCode: 300
          });

          await admin.save();
          await user.save();

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
            console.error("Failed to send deposit email:", emailError);
            // Optionally, you can log this failure or send a different notification to admins
          }

          // Return a JSON response with the transaction status
          transactionInProgress = false;
          return res.status(508).json({
            success: 508,
            message: "failed to generate",
            userTransaction,
          });
        }


        // INITIATE MOBCASH TRANSACTION

        const response = await rechargeAccount(betId, amount);
        console.log(response, "response")
        if (response.Success === false && response.MessageId === 100337) {
          const userTransaction = {
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            betId: betId,
            network: network,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: amount,
            totalAmount: amount,
            paymentConfirmation: "Failed",
            customErrorCode: 300
          };
          user.transactionHistory.push(userTransaction);
          admin.transactionHistory.push({
            userid: user._id,
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            totalAmount: amount,
            betId: betId,
            network: network,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Failed",
            bonusBalance: amount,
            customErrorCode: 300
          });
          await user.save();
          await admin.save();

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
            console.error("Failed to send deposit email:", emailError);
            // Optionally, you can log this failure or send a different notification to admins
          }


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
        if (response.Success === false && response.MessageId === 100323) {
          const userTransaction = {
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: amount,
            totalAmount: amount,
            paymentConfirmation: "Failed",
            customErrorCode: 301
          };
          user.transactionHistory.push(userTransaction);
          admin.transactionHistory.push({
            userid: user._id,
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            totalAmount: amount,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Failed",
            bonusBalance: amount,
            customErrorCode: 301
          });
          await user.save();
          await admin.save();
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
            console.error("Failed to send deposit email:", emailError);
            // Optionally, you can log this failure or send a different notification to admins
          }

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
        if (response.Success === false) {
          console.log("333333")
          const userTransaction = {
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: amount,
            totalAmount: amount,
            paymentConfirmation: "Failed",
          };
          user.transactionHistory.push(userTransaction);
          admin.transactionHistory.push({
            userid: user._id,
            status: "Failed",
            registrationDateTime: date,
            amount: 0,
            totalAmount: amount,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            network: network,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Failed",
            bonusBalance: amount,
          });
          await user.save();
          await admin.save();
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
            console.error("Failed to send deposit email:", emailError);
            // Optionally, you can log this failure or send a different notification to admins
          }
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
        const updatedBonusBalance = user.bonusBalance - amount;
        const userTransaction = {
          status: "Successful",
          registrationDateTime: date,
          amount: 0,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          network: network,
          fundingType: "deposits",
          identifierId: newUuid,
          service: service,
          bonusBalance: amount,
          totalAmount: amount,
          paymentConfirmation: "Successful",
        };
        admin.transactionHistory.push({
          userid: user._id,
          status: "Successful",
          registrationDateTime: date,
          amount: 0,
          totalAmount: amount,
          betId: betId,
          // momoName: momoName,
          momoNumber: momoNumber,
          network: network,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: "none",
          service: service,
          paymentConfirmation: "Successful",
          bonusBalance: amount,
        });
        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        user.bonusBalance = updatedBonusBalance;
        await user.save();
        await admin.save();
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
          console.error("Failed to send deposit email:", emailError);
          // Optionally, you can log this failure or send a different notification to admins
        }
        const newUserBonus = user.bonusBalance;
        // Return a JSON response with the transaction status
        transactionInProgress = false;
        return res
          .status(200)
          .json({
            success: true,
            message: "transaction generated successfully",
            newUserBonus,
            userTransaction,
            user
          });
      }
      if (bonusBalance < amount) {
        console.log("done")
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

        const newUuid = generateUniqueShortUuid(15);
        const date = new Date();

        // Check for similar transactions in the last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
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
        if (recentTransaction !== undefined) {
          transactionInProgress = false;
          const userTransaction = {
            status: "Failed",
            registrationDateTime: date,
            amount: updatedAmount,
            totalAmount: amount,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: user.bonusBalance,
            paymentConfirmation: "Failed",
            customErrorCode: 302
          };

          admin.transactionHistory.push({
            userid: user._id,
            status: "Failed",
            registrationDateTime: date,
            amount: updatedAmount,
            betId: betId,
            totalAmount: amount,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Failed",
            bonusBalance: user.bonusBalance,
            customErrorCode: 302

          });
          user.transactionHistory.push(userTransaction);
          user.bonus.push(userTransaction);
          await admin.save();
          await user.save();

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
            console.error("Failed to send deposit email:", emailError);
            // Optionally, you can log this failure or send a different notification to admins
          }

          transactionInProgress = false;
          return res
            .status(510)
            .json({
              success: 510,
              message: "failed to generate",
              userTransaction,
              user
            });
        }

        updatedAmount = amount - user.bonusBalance;
        const fullname = user.fullname
        const result = await makePaymentRequest(updatedAmount, momoNumber, network, fullname, newUuid
        );

        if (result !== "SUCCESSFUL") {
          if (result.status === 'PENDING') {
            const userTransaction = {
              status: "Pending",
              registrationDateTime: date,
              amount: updatedAmount,
              totalAmount: amount,
              betId: betId,
              network: network,
              // momoName: momoName,
              momoNumber: momoNumber,
              fundingType: "deposits",
              identifierId: newUuid,
              service: service,
              bonusBalance: user.bonusBalance,
              paymentConfirmation: "Pending",
              customErrorCode: 302
            };

            admin.transactionHistory.push({
              userid: user._id,
              status: "Pending",
              registrationDateTime: date,
              amount: updatedAmount,
              betId: betId,
              totalAmount: amount,
              network: network,
              // momoName: momoName,
              momoNumber: momoNumber,
              fundingType: "deposits",
              identifierId: newUuid,
              userEmail: email,
              subadminEmail: "none",
              service: service,
              paymentConfirmation: "Pending",
              bonusBalance: user.bonusBalance,
              customErrorCode: 302

            });
            admin.pendingTransactions.push({
              userid: user._id,
              status: "Pending",
              registrationDateTime: date,
              amount: updatedAmount,
              betId: betId,
              totalAmount: amount,
              network: network,
              // momoName: momoName,
              momoNumber: momoNumber,
              fundingType: "deposits",
              identifierId: newUuid,
              userEmail: email,
              subadminEmail: "none",
              service: service,
              paymentConfirmation: "Pending",
              bonusBalance: user.bonusBalance,
              customErrorCode: 302
            });
            user.bonusBalance = 0;
            user.transactionHistory.push(userTransaction);
            user.bonus.push(userTransaction);
            await admin.save();
            await user.save();
            transactionInProgress = false;
            const newUserBonus = user.bonusBalance;
            return res
              .status(209)
              .json({
                success: 209,
                message: "failed to generate",
                userTransaction,
                newUserBonus,
                user
              });
          } else {
            const userTransaction = {
              status: "Failed",
              registrationDateTime: date,
              amount: updatedAmount,
              totalAmount: amount,
              betId: betId,
              network: network,
              // momoName: momoName,
              momoNumber: momoNumber,
              fundingType: "deposits",
              identifierId: newUuid,
              service: service,
              bonusBalance: user.bonusBalance,
              paymentConfirmation: "Failed",
              customErrorCode: 302
            };

            admin.transactionHistory.push({
              userid: user._id,
              status: "Failed",
              registrationDateTime: date,
              amount: updatedAmount,
              network: network,
              betId: betId,
              totalAmount: amount,
              // momoName: momoName,
              momoNumber: momoNumber,
              fundingType: "deposits",
              identifierId: newUuid,
              userEmail: email,
              subadminEmail: "none",
              service: service,
              paymentConfirmation: "Failed",
              bonusBalance: user.bonusBalance,
              customErrorCode: 302

            });
            user.transactionHistory.push(userTransaction);
            user.bonus.push(userTransaction);
            await admin.save();
            await user.save();

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
              console.error("Failed to send deposit email:", emailError);
              // Optionally, you can log this failure or send a different notification to admins
            }
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

        if (response.Success === false && response.MessageId === 100337) {
          const userTransaction = {
            status: "Pending",
            registrationDateTime: date,
            amount: updatedAmount,
            totalAmount: amount,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            network: network,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: user.bonusBalance,
            paymentConfirmation: "Successful",
            customErrorCode: 300
          };
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
            network: network,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Successful",
            bonusBalance: user.bonusBalance,
            customErrorCode: 300
          });
          user.transactionHistory.push(userTransaction);
          user.bonus.push(userTransaction);
          user.bonusBalance = 0;
          await user.save();
          await admin.save();
          const newUserBonus = user.bonusBalance;
          transactionInProgress = false
          return res.status(200).json({
            success: true,
            message: "Transaction wasnt fully completed",
            userTransaction,
            newUserBonus,
            user
          });
        }
        if (response.Success === false && response.MessageId === 100323) {
          const userTransaction = {
            status: "Pending",
            registrationDateTime: date,
            amount: updatedAmount,
            totalAmount: amount,
            betId: betId,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            network: network,
            service: service,
            bonusBalance: user.bonusBalance,
            paymentConfirmation: "Successful",
            customErrorCode: 301
          };
          admin.transactionHistory.push({
            userid: user._id,
            status: "Pending",
            registrationDateTime: date,
            amount: updatedAmount,
            betId: betId,
            totalAmount: amount,
            // momoName: momoName,
            network: network,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Successful",
            bonusBalance: user.bonusBalance,
            customErrorCode: 301
          });
          user.transactionHistory.push(userTransaction);
          user.bonus.push(userTransaction);
          user.bonusBalance = 0;
          await user.save();
          await admin.save();
          const newUserBonus = user.bonusBalance;
          transactionInProgress = false
          return res.status(200).json({
            success: true,
            message: "Transaction wasnt fully completed",
            userTransaction,
            newUserBonus,
            user
          });
        }
        if (response.Success === false) {
          const userTransaction = {
            status: "Pending",
            registrationDateTime: date,
            amount: updatedAmount,
            totalAmount: amount,
            betId: betId,
            network: network,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            service: service,
            bonusBalance: user.bonusBalance,
            paymentConfirmation: "Successful",
          };

          user.transactionHistory.push(userTransaction);
          user.bonus.push(userTransaction);
          user.bonusBalance = 0;
          await user.save();

          admin.transactionHistory.push({
            userid: user._id,
            status: "Pending",
            registrationDateTime: date,
            amount: updatedAmount,
            betId: betId,
            totalAmount: amount,
            network: network,
            // momoName: momoName,
            momoNumber: momoNumber,
            fundingType: "deposits",
            identifierId: newUuid,
            userEmail: email,
            subadminEmail: "none",
            service: service,
            paymentConfirmation: "Successful",
            bonusBalance: user.bonusBalance,
          });

          await admin.save();
          const newUserBonus = user.bonusBalance;
          transactionInProgress = false
          return res.status(200).json({
            success: true,
            message: "Transaction wasnt fully completed",
            userTransaction,
            newUserBonus,
            user
          });
        }


        const userTransaction = {
          status: "Successful",
          registrationDateTime: date,
          amount: updatedAmount,
          totalAmount: amount,
          betId: betId,
          network: network,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          service: service,
          bonusBalance: user.bonusBalance,
          paymentConfirmation: "Successful",
        };
        admin.transactionHistory.push({
          userid: user._id,
          status: "Successful",
          registrationDateTime: date,
          amount: updatedAmount,
          betId: betId,
          totalAmount: amount,
          network: network,
          // momoName: momoName,
          momoNumber: momoNumber,
          fundingType: "deposits",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: "none",
          service: service,
          paymentConfirmation: "Successful",
          bonusBalance: user.bonusBalance,
        });

        user.transactionHistory.push(userTransaction);
        user.bonus.push(userTransaction);
        user.bonusBalance = 0;
        await user.save();
        await admin.save()

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
          console.error("Failed to send deposit email:", emailError);
          // Optionally, you can log this failure or send a different notification to admins
        }
        const newUserBonus = user.bonusBalance;
        transactionInProgress = false;
        return res
          .status(200)
          .json({
            success: true,
            message: "transaction generated successfully",
            user,
            newUserBonus,
            userTransaction
          });

      }
    }
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request for deposit:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});



router.post("/walletdeposit", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;

    // Validate the request body
    const errors = validateDepositRequest2(req.body);
    if (errors.length > 0) {
      console.log(errors, "error");
      transactionInProgress = false;
      return res.status(400).json({ success: 400, message: "invalid Input", status: 400 });
    }

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
        .json({
          success: 502,
          message: "User is deactivated",
          status: 502,
        });
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
    if (user.bonusBalance < amount) {
      return res
        .status(506)
        .json({
          success: 506,
          message: "wallet balance not sufficient",
          status: 506,
        });
    }
    const date = new Date();
    const newUuid = generateUniqueShortUuid(15);
    // INITIATE MOBCASH TRANSACTION

    // const response = await rechargeAccount(betId, amount);
    // console.log(response, "response")
    // if (response.Success === false && response.MessageId === 100337) {
    //   console.log("111111")
    //   const userTransaction = {
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     service: service,
    //     bonusBalance: amount,
    //     totalAmount: amount,
    //     paymentConfirmation: "Failed",
    //     customErrorCode: 300
    //   };
    //   user.transactionHistory.push(userTransaction);
    //   admin.transactionHistory.push({
    //     userid: user._id,
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     totalAmount: amount,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     userEmail: email,
    //     subadminEmail: "none",
    //     service: service,
    //     paymentConfirmation: "Failed",
    //     bonusBalance: amount,
    //     customErrorCode: 300
    //   });
    //   await user.save();
    //   await admin.save();

    //   try {
    //     await SendEmail({
    //       email: email,
    //       userId: user._id,
    //       emailType: "FAILEDDEPOSIT",
    //       fullname: user.fullname,
    //       amount: amount,
    //       betId: betId,
    //     });
    //   } catch (emailError) {
    //     console.error("Failed to send deposit email:", emailError);
    //     // Optionally, you can log this failure or send a different notification to admins
    //   }

    //   transactionInProgress = false;
    //   return res
    //     .status(209)
    //     .json({
    //       success: 209,
    //       message: "failed to generate",
    //       userTransaction,
    //       user
    //     });
    // }
    // if (response.Success === false && response.MessageId === 100323) {
    //   console.log("22222")
    //   const userTransaction = {
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     service: service,
    //     bonusBalance: amount,
    //     totalAmount: amount,
    //     paymentConfirmation: "Failed",
    //     customErrorCode: 301
    //   };
    //   user.transactionHistory.push(userTransaction);
    //   admin.transactionHistory.push({
    //     userid: user._id,
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     totalAmount: amount,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     userEmail: email,
    //     subadminEmail: "none",
    //     service: service,
    //     paymentConfirmation: "Failed",
    //     bonusBalance: amount,
    //     customErrorCode: 301
    //   });
    //   await user.save();
    //   await admin.save();

    //   try {
    //     await SendEmail({
    //       email: email,
    //       userId: user._id,
    //       emailType: "FAILEDDEPOSIT",
    //       fullname: user.fullname,
    //       amount: amount,
    //       betId: betId,
    //     });
    //   } catch (emailError) {
    //     console.error("Failed to send deposit email:", emailError);
    //     // Optionally, you can log this failure or send a different notification to admins
    //   }

    //   transactionInProgress = false;
    //   return res
    //     .status(209)
    //     .json({
    //       success: 209,
    //       message: "failed to generate",
    //       userTransaction,
    //       user
    //     });
    // }
    // if (response.Success === false) {
    //   console.log("333333")
    //   const userTransaction = {
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     service: service,
    //     bonusBalance: amount,
    //     totalAmount: amount,
    //     paymentConfirmation: "Failed",
    //   };
    //   user.transactionHistory.push(userTransaction);
    //   admin.transactionHistory.push({
    //     userid: user._id,
    //     status: "Failed",
    //     registrationDateTime: date,
    //     amount: 0,
    //     totalAmount: amount,
    //     betId: betId,
    //     // momoName: momoName,
    //     momoNumber: momoNumber,
    //     fundingType: "deposits",
    //     identifierId: newUuid,
    //     userEmail: email,
    //     subadminEmail: "none",
    //     service: service,
    //     paymentConfirmation: "Failed",
    //     bonusBalance: amount,
    //   });
    //   await user.save();
    //   await admin.save();

    //   try {
    //     await SendEmail({
    //       email: email,
    //       userId: user._id,
    //       emailType: "FAILEDDEPOSIT",
    //       fullname: user.fullname,
    //       amount: amount,
    //       betId: betId,
    //     });
    //   } catch (emailError) {
    //     console.error("Failed to send deposit email:", emailError);
    //     // Optionally, you can log this failure or send a different notification to admins
    //   }


    //   transactionInProgress = false;
    //   return res
    //     .status(209)
    //     .json({
    //       success: 209,
    //       message: "failed to generate",
    //       userTransaction,
    //       user
    //     });
    // }
    const updatedBonusBalance = user.bonusBalance - amount;
    const userTransaction = {
      status: "Successful",
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
      paymentConfirmation: "Successful",
    };
    admin.transactionHistory.push({
      userid: user._id,
      status: "Successful",
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
      paymentConfirmation: "Successful",
      bonusBalance: amount,
    });
    user.transactionHistory.push(userTransaction);
    user.bonus.push(userTransaction);
    user.bonusBalance = updatedBonusBalance;
    await user.save();
    await admin.save();

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
      console.error("Failed to send deposit email:", emailError);
      // Optionally, you can log this failure or send a different notification to admins
    }

    const newUserBonus = user.bonusBalance;
    // Return a JSON response with the transaction status
    transactionInProgress = false;
    return res
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
      email
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

      const newUuid = uuidv4();
      const date = new Date();



      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        withdrawalCode: withdrawalCode,
        amount: 0,
        totalAmount: amount,
        betId: betId,
        momoNumber: momoNumber,
        fundingType: "withdrawals",
        identifierId: newUuid,
        service: service,
        paymentConfirmation: "Successful",
        bonusBalance: amount
      };

      admin.transactionHistory.push({
        userid: user._id,
        status: "Pending",
        registrationDateTime: date,
        amount: 0,
        totalAmount: amount,
        betId: betId,
        momoNumber: momoNumber,
        fundingType: "withdrawals",
        identifierId: newUuid,
        userEmail: email,
        subadminEmail: "none",
        service: service,
        paymentConfirmation: "Successful",
        bonusBalance: amount
      });

      user.transactionHistory.push(userTransaction);
      const updatedBalance = getBalance - amount
      user.bonusBalance = updatedBalance
      await user.save();
      await admin.save();

      try {
        await SendEmail({
          email: email,
          userId: user._id,
          emailType: "PENDINGWITHDRAWAL",
          fullname: user.fullname,
          amount: amount,
          betId: betId,
        });
      } catch (emailError) {
        console.error("Failed to send deposit email:", emailError);
        // Optionally, you can log this failure or send a different notification to admins
      }
      transactionInProgress = false;
      return res.status(200).json({
        success: true,
        message: "Transaction fully completed",
        userTransaction,
        user
      });


    } else {
      const admin = await AdminUser.findOne({ isAdmin: true });
      console.log('closed')
      console.log(admin.isWithdrawalsOpen, 'first')
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
      console.log(user, "gggg")
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


      const newUuid = generateUniqueShortUuid(15);
      const date = new Date();

      // INITIATE MOBCASH TRANSACTION
      const response = await withdrawFromAccount(betId, withdrawalCode);

      const updatedResponse = removeMinusFromSumma(response);
      if (updatedResponse.Success !== true) {
        const userTransaction = {
          status: "Failed",
          registrationDateTime: date,
          withdrawalCode: withdrawalCode,
          betId: betId,
          amount: 0,
          totalAmount: 0,
          momoNumber: momoNumber,
          fundingType: "withdrawals",
          identifierId: newUuid,
          service: service,
          paymentConfirmation: "Failed",
        };
        admin.transactionHistory.push({
          userid: user._id,
          status: "Failed",
          registrationDateTime: date,
          betId: betId,
          amount: 0,
          totalAmount: 0,
          momoNumber: momoNumber,
          fundingType: "withdrawals",
          identifierId: newUuid,
          userEmail: email,
          subadminEmail: "none",
          service: service,
          paymentConfirmation: "Failed",

        });
        user.transactionHistory.push(userTransaction);
        await user.save();
        await admin.save();

        try {
          await SendEmail({
            email: email,
            userId: user._id,
            emailType: "FAILEDWITHDRAWAL",
            fullname: user.fullname,
            amount: amount,
            betId: betId,
          });
        } catch (emailError) {
          console.error("Failed to send deposit email:", emailError);
          // Optionally, you can log this failure or send a different notification to admins
        }
        transactionInProgress = false;
        return res.status(209).json({
          success: 209,
          message: "Transaction wasnt fully completed",
          userTransaction,
          user
        });
      }


      const userTransaction = {
        status: "Pending",
        registrationDateTime: date,
        withdrawalCode: withdrawalCode,
        amount: updatedResponse.Summa,
        totalAmount: updatedResponse.Summa,
        betId: betId,
        momoNumber: momoNumber,
        fundingType: "withdrawals",
        identifierId: newUuid,
        service: service,
        paymentConfirmation: "Successful",
      };

      admin.transactionHistory.push({
        userid: user._id,
        status: "Pending",
        registrationDateTime: date,
        amount: updatedResponse.Summa,
        totalAmount: updatedResponse.Summa,
        betId: betId,
        momoNumber: momoNumber,
        fundingType: "withdrawals",
        identifierId: newUuid,
        userEmail: email,
        subadminEmail: "none",
        service: service,
        paymentConfirmation: "Successful",
      });

      user.transactionHistory.push(userTransaction);
      await user.save();
      await admin.save();

      try {
        await SendEmail({
          email: email,
          userId: user._id,
          emailType: "PENDINGWITHDRAWAL",
          fullname: user.fullname,
          amount: amount,
          betId: betId,
        });
      } catch (emailError) {
        console.error("Failed to send deposit email:", emailError);
        // Optionally, you can log this failure or send a different notification to admins
      }
      transactionInProgress = false;
      return res.status(200).json({
        success: true,
        message: "Transaction wasnt fully completed",
        userTransaction,
        user
      });
    }


  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request for deposit:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



router.get("/getSocials", async (req, res) => {
  try {
    transactionInProgress = true;

    const whatsapp = "https://wa.me/22957577103"
    const email = "support@betfundr.com"
    const twitter = ""
    const phone = "+22957577103"
    // const phone = "+22957577103"
    const data = {
      whatsapp: whatsapp,
      email: email,
      twitter: twitter,
      phone: phone
    }
    transactionInProgress = false;
    return res
      .status(201)
      .json({ success: 201, data: data, status: 201 });

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
      })).slice(0, 100);

    if (search.length > 0) {
      transactionInProgress = false;
      return res
        .status(200)
        .json({
          success: true,
          message: "User(s) found",
          status: true,
          search,
        })
    }

    const search2 = users
      .filter((user) => user?.tag?.toLowerCase().startsWith(lowerCaseValue))
      .map((user) => ({
        _id: user._id,
        tag: user.tag,
        email: user.email,
        fullname: user.fullname,
        image: user.image,
      })).slice(0, 100);

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

    const date = new Date();
    const newUuid = generateUniqueShortUuid(15);

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

    await recipient.save();
    await user.save();
    await admin.save();

    try {
      await SendEmail({
        email: user.email,
        userId: user._id,
        emailType: "SUCCESSFULWALLETSEND",
        fullname: user.fullname,
        amount: amount,
        betId: user.betId,
        recipient: recipient.fullname,
      });
    } catch (emailError) {
      console.error("Failed to send deposit email:", emailError);
      // Optionally, you can log this failure or send a different notification to admins
    }

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


router.get('/privacy-policies', (req, res) => {
  try {
    // Define file paths
    const englishPolicyPath = path.join(__dirname, '../utils/saved_policies', 'privacy_policy_en.txt');
    const frenchPolicyPath = path.join(__dirname, '../utils/saved_policies', 'privacy_policy_fr.txt');

    // Read both files synchronously (or use async with promises if preferred)
    const englishPolicy = fs.readFileSync(englishPolicyPath, 'utf8');
    const frenchPolicy = fs.readFileSync(frenchPolicyPath, 'utf8');


    console.log(englishPolicy, "englishPolicy")
    console.log(frenchPolicy, "frenchPolicy")

    const policies = {
      englishPolicy: englishPolicy,
      frenchPolicy: frenchPolicy
    }
    // Send both policies in a JSON response
    res.status(200).json({
      policies,
    });

  } catch (error) {
    console.error('Error reading privacy policies:', error);
    res.status(500).json({ message: 'Error retrieving privacy policies' });
  }
});





router.post("/submitDeleteAccountForm", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;



    const { email, password } =
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
        .json({
          success: 502,
          message: "User is deactivated",
          status: 502,
        });
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

    // Check if password is correct
    const validPassword = await bcryptjs.compare(
      password,
      user.password
    );
    if (!validPassword) {
      transactionInProgress = false;
      return res
        .status(503)
        .send({ success: 503, message: "Invalid password", status: 503 });
    }

    const date = new Date();
    user.deleteRequestState = true;

    admin.deleteRequest.push({
      userid: user._id,
      email: user.email,
      registrationDateTime: date,
      deleteRequestState: true,
    });



    user.isActivated = false;

    await user.save();
    await admin.save();
    transactionInProgress = false;
    return res
      .status(200)
      .json({
        success: true,
        message: "successful",
      });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error completing the request", error);
    res.status(500).json({ error: "Internal server error" });
  }
});








// checkBalance()
//     .then(response => console.log(response))
//     .catch(error => console.error('Error:', error));


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

function removeMinusFromSumma(apiResponse) {
  if (apiResponse && typeof apiResponse.Summa === 'number') {
    apiResponse.Summa = Math.abs(apiResponse.Summa);
  }
  return apiResponse;
}

function calculatePercentage(amount) {
  const threePercent = amount * 0.03;
  const thirtythreePercentOfThreePercent = threePercent * 0.33;
  return thirtythreePercentOfThreePercent;
}
