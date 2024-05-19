/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */


const mongoose = require('mongoose'); 
const subAdminSchema = new mongoose.Schema({
    fullname: {
        type: String,
        required: [true, "Please provide a fullname"],
    },
    betId: {
        type: String,
        required: [true, "Please provide your betId"],
    },
    number: {
        type: Number,
        required: [true, "Please provide a phone"],
    },

    email: {
        type: String,
        required: [true, "Please provide an email"],
        unique: true,
    },

    password: {
        type: String,
        required: [true, "Please provide a password"],
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
    image: { type: String, default: "" },
    imageFileName: { type: String, default: "" },

    isLoggedIn: {
        type: Boolean,
        default: false,
    },
    isActivated: {
        type: Boolean,
        default: true,
    },
    pinState: {
        type: Boolean,
        default: false,
    },

    colorScheme: {
        type: Number,
        default: 2,
    },
    tag: {
        type: String,
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
        type: String,
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
                paymentConfirmation: String,
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

    transactionHistory: {
        type: [
            {
                username: String,
                userNumber: Number,
                userid: String,
                status: String,
                registrationDateTime: Date,
                withdrawalCode: String,
                momoName: String,
                momoNumber: Number,
                amount: Number,
                network: String,
                betId: String,
                transactionId: String,
                fundingType: String,
                identifierId: String,
                userEmail: String,
                subadminEmail: String,
                paymentConfirmation: String,
                totalAmount: Number,
                service: String,
                isSubmitted: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
    },

    forgotPasswordToken: String,
    forgotPasswordTokenExpiry: Date,
});

module.exports = mongoose.model('subadmins', subAdminSchema);