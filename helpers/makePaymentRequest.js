/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
require("dotenv").config();
const fetch = require('node-fetch');

async function makePaymentRequest(amount, momoNumber, network, fullname, newUuid) {
    try {
        const [firstname, lastname] = fullname.split(' ');
        const QOS_string = network.toLowerCase() === "mtn" ? process.env.QOS_STRING_FOR_MTN_PAYMENT : process.env.QOS_STRING_FOR_MOOV_PAYMENT;
        const QOS_username = network.toLowerCase() === "mtn" ? process.env.QOS_USERNAME1 : process.env.QOS_USERNAME2;
        const QOS_password = process.env.QOS_PASSWORD;
        const QOS_string_check_transaction = process.env.QOS_STRING_CHECK_TRANSACTION;
        const QOS_clientid = network.toLowerCase() === "mtn" ? process.env.QOS_CLIENTID1 : process.env.QOS_CLIENTID2;

        const response = await fetch(
            QOS_string,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Basic " + Buffer.from(`${QOS_username}:${QOS_password}`).toString('base64'),
                },
                body: JSON.stringify({
                    msisdn: `229${momoNumber}`,
                    amount: amount,
                    firstname: firstname,
                    lastname: lastname ? lastname : firstname,
                    transref: newUuid,
                    clientid: QOS_clientid,
                }),
            }
        );

        const data = await pollTransactionStatus(QOS_string_check_transaction, QOS_username, QOS_password, QOS_clientid, newUuid);
        const result = {
            status: data,
            transactionId: newUuid
        }

        return result
    } catch (error) {
        console.error('Error making payment request:', error);
        throw new Error('Payment request failed');
    }
}


// WITH PROMISE
async function pollTransactionStatus(url, username, password, clientid, transref) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const interval = 10000; // Check every 10 seconds
        const timeout = 60000; // Timeout after 1 minute
        const maxAttempts = 6; // Maximum number of attempts (timeout/interval)
        let attempts = 0;

        const intervalId = setInterval(async () => {
            attempts += 1;

            if (Date.now() - startTime >= timeout || attempts >= maxAttempts) {
                clearInterval(intervalId);
                return resolve('PENDING');
            }

            try {
                const checkStatus = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString('base64'),
                    },
                    body: JSON.stringify({
                        clientid: clientid,
                        transref: transref,
                    }),
                });

                const statusData = await checkStatus.json();
                console.log("Status Check Response:", statusData);

                if (statusData.responsemsg === "SUCCESSFUL") {
                    clearInterval(intervalId);
                    return resolve("SUCCESSFUL");
                } else if (statusData.responsemsg !== "PENDING") {
                    clearInterval(intervalId);
                    return resolve("FAILED");
                }

            } catch (error) {
                console.error('Error checking transaction status:', error);
                clearInterval(intervalId);
                return resolve('PENDING');
            }
        }, interval);
    });
}



module.exports = { makePaymentRequest };







// API Response: {
//   responsecode: '-1',
//   responsemsg: 'FAILED',
//   transref: 'lxc3x4urcBjWD8H',
//   serviceref: '7437068871',
//   comment: null
// }

// API Response: {
//     responsecode: '01',
//         responsemsg: 'PENDING',
//             transref: 'lxc3x4urcBjWD8H',
//                 serviceref: '7437068871',
//                     comment: null
// }