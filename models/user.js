/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  fullname: {
    type: String,
    required: [false, "Please provide a fullname"],
  },
  betId: {
    type: String,
    required: [false, "Please provide your betId"],
  },
  number: {
    type: Number,
    required: [false, "Please provide a phone"],
  },

  email: {
    type: String,
    required: [false, "Please provide an email"],
    unique: true,
  },
  tag: {
    type: String,
  },
  password: {
    type: String,
    required: [false, "Please provide a password"],
  },
  pin: {
    type: String,
  },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Post" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  image: { type: String, default: "" },
  imageFileName: { type: String, default: "" },
  pushToken: { type: String, default: "" },
  pinState: {
    type: Boolean,
    default: false,
  },
  fedapayId: {
    type: Number,
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  isUser: {
    type: Boolean,
    default: false,
  },

  isSubAdminDeposits: {
    type: Boolean,
    default: false,
  },

  isSubAdminWithdrawals: {
    type: Boolean,
    default: false,
  },

  cashdeskDialcode: {
    type: String,
  },

  isLoggedIn: {
    type: Boolean,
    default: false,
  },
  isActivated: {
    type: Boolean,
    default: true,
  },
  current: {
    type: Boolean,
    default: false,
  },
  currentCount: {
    type: Number,
    default: 0,
  },
  successfulDepositCount: {
    type: Number,
    default: 0,
  },
  succesfulWithdrawalCount: {
    type: Number,
    default: 0,
  },
  registrationDateTime: {
    type: Date,
  },

  isOutOfFunds: {
    type: Boolean,
    default: false,
  },
  isDepositsOpen: {
    type: Boolean,
    default: true,
  },
  isWithdrawalsOpen: {
    type: Boolean,
    default: true,
  },
  supplementaryBetId: {
    type: [
      {
        type: String,
      },
    ],
  },
  referer: { type: String, default: "" },
  referrals: {
    type: [
      {
        type: String,
      },
    ],
  },
  pendingDeposit: {
    type: [
      {
        fedapayTransactionId: String || Number,
        transactionId: String,
        createdAt: String,
        status: String,
        amount: String || Number,
        betId: String || Number,
        momoName: String || Number,
        momoNumber: String || Number,
        service: String,
        totalAmount: String,
        QrCodeDepositsId: String,
        authenticatedDeposit: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },
  cashdeskAddress: {
    type: {
      city: String,
      street: String,
    },
  },
  sessionId: {
    type: String,
  },
  bonusBalance: {
    type: Number,
    default: 0,
  },
  restrictedBonusBalance: {
    type: Number,
    default: 0,
  },
  disbursedBonusBalance: {
    type: Number,
    default: 0,
  },
  colorScheme: {
    type: Number,
    default: 2,
  },
  bonus: {
    type: [
      {
        fundingType: String,
        bonusAmount: Number,
        registrationDateTime: Date,
        identifierId: String,
        status: String,
        amount: String,
        totalAmount: String,
        betId: String,
        number: Number,
        depositName: String,
        momoNumber: Number,
        companyWithdrawalAddress: String,
        withdrawalCode: String,
        withdrawalName: String,
        withdrawalNumber: Number,
        recipientName: String,
        recipientTag: String,
        service: String,
        bonusBalance: Number,
        paymentConfirmation: String,
        fedapayTransactionId: String || Number,
        recipientid: String,
        customErrorCode: Number,
      },
    ],
  },
  transactionHistory: {
    type: [
      {
        // username: String,
        // userNumber: Number,
        // userid: String,
        // status: String,
        // registrationDateTime: Date,
        // withdrawalCode: String,
        // momoName: String,
        // momoNumber: Number,
        // amount: Number,
        // network: String,
        // betId: String,
        // transactionId: String,
        // fundingType: String,
        // identifierId: String,
        // userEmail: String,
        // subadminEmail: String,
        senderName: String,
        recipientName: String,
        recipientTag: String,
        recipientid: String,
        betId: String,
        amount: Number,
        fundingType: String,
        identifierId: String,
        withdrawalCode: String,
        momoName: String,
        momoNumber: Number,
        status: String,
        network: String,
        totalAmount: String,
        registrationDateTime: Date,
        service: String,
        bonusBalance: Number,
        userEmail: String,
        subadminEmail: String,
        fedapayTransactionId: String || Number,
        paymentConfirmation: String,
        QrCodeDepositsId: String,
        customErrorCode: Number,
        authenticatedDeposit: {
          type: Boolean,
          default: true,
        },
      },
    ],
  },

  forgotPasswordToken: String,
  forgotPasswordTokenExpiry: Date,
  pinreset: String,
  pinExpiryTime: Date,
});

module.exports = mongoose.model("User", UserSchema);
