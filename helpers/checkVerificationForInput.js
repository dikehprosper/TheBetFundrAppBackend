/* eslint-disable no-useless-escape */
/* eslint-disable no-undef */
function validateDepositRequest(data) {
    console.log(data, "data")
    const errors = [];

    if (!data.email || !validateEmail(data.email)) {
        errors.push("Invalid or missing email.");
    }

    if (!data.betId) {
        errors.push("Missing betId.");
    }

    if (!data.amount || isNaN(data.amount) || data.amount < 100) {
        errors.push("Invalid or missing amount.");
    }

    if (!data.momoNumber || !/^\d{8}$/.test(data.momoNumber)) {
        errors.push("Invalid or missing momoNumber.");
    }

    if (!data.network) {
        errors.push("Invalid or missing network.");
    }

    if (!data.service) {
        errors.push("Missing service.");
    }
    if (data.bonusBalance !== null) {
        console.log(data.bonusBalance)
        if (typeof data.bonusBalance === 'number' && data.bonusBalance < 0) {
            errors.push("Invalid bonusBalance: cannot be negative.");
        } else if (typeof data.bonusBalance !== 'number' && typeof data.bonusBalance !== 'string') {
            errors.push("Invalid bonusBalance: must be a number or a string.");
        }
    }
    return errors;
}

function validateDepositRequest2(data) {
    console.log(data, "data")
    const errors = [];

    if (!data.email || !validateEmail(data.email)) {
        errors.push("Invalid or missing email.");
    }

    if (!data.betId) {
        errors.push("Missing betId.");
    }

    if (!data.amount || isNaN(data.amount) || data.amount < 100) {
        errors.push("Invalid or missing amount.");
    }

    if (!data.momoNumber || !/^\d{8}$/.test(data.momoNumber)) {
        errors.push("Invalid or missing momoNumber.");
    }

    if (!data.service) {
        errors.push("Missing service.");
    }
    if (data.bonusBalance !== null) {
        console.log(data.bonusBalance)
        if (typeof data.bonusBalance === 'number' && data.bonusBalance < 0) {
            errors.push("Invalid bonusBalance: cannot be negative.");
        } else if (typeof data.bonusBalance !== 'number' && typeof data.bonusBalance !== 'string') {
            errors.push("Invalid bonusBalance: must be a number or a string.");
        }
    }
    return errors;
}



// function validateDepositRequest2(data) {
//     const errors = [];

//     if (!data.email || !validateEmail(data.email)) {
//         errors.push("Invalid or missing email.");
//     }

//     if (!data.betId) {
//         errors.push("Missing betId.");
//     }

//     if (!data.amount || isNaN(data.amount) || data.amount <= 200) {
//         errors.push("Invalid or missing amount.");
//     }

//     if (!data.momoNumber || !/^\d{8}$/.test(data.momoNumber)) {
//         errors.push("Invalid or missing momoNumber.");
//     }

//     if (!data.network) {
//         errors.push("Invalid or missing network.");
//     }

//     if (!data.service) {
//         errors.push("Missing service.");
//     }
//     if (data.bonusBalance !== null) {
//         console.log(data.bonusBalance)
//         if (typeof data.bonusBalance === 'number' && data.bonusBalance < 0) {
//             errors.push("Invalid bonusBalance: cannot be negative.");
//         } else if (typeof data.bonusBalance !== 'number' && typeof data.bonusBalance !== 'string') {
//             errors.push("Invalid bonusBalance: must be a number or a string.");
//         }
//     }
//     return errors;
// }

function validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([^<>()[\]\\.,;:\s@"]+\.)+[^<>()[\]\\.,;:\s@"]{2,})$/i;
    return re.test(String(email).toLowerCase());
}

module.exports = { validateDepositRequest, validateDepositRequest2 };