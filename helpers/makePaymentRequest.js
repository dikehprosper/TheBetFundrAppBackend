/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
// Assuming you have imported the necessary modules and paymentEvents
const paymentEvents = require('./events');

async function makePaymentRequest(amount, momoNumber, network, fullname, newUuid) {
    const fetch = (await import('node-fetch')).default;
    function waitForTransactionUpdate(newUuid) {
        return new Promise((resolve) => {
            let resolved = false;  // Flag to prevent resolving the promise multiple times

            // Default response if no update is received within the timeout
            const defaultResult = {
                status: null,
                transactionId: null,
            };

            // Setup a timeout to resolve the promise if no data is received
            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    console.log('Timeout reached without receiving transaction update');
                    resolved = true;
                    resolve(defaultResult);
                }
            }, 60000);  // 60 seconds timeout

            // Set up the event listener
            paymentEvents.once('transactionReceived', (data) => {
                if (!resolved && data.transref === newUuid) {
                    console.log('Transaction data received during payment request:', data);
                    clearTimeout(timeoutId);
                    resolved = true;

                    if (data.status === "SUCCESSFUL") {
                        resolve({
                            status: "SUCCESSFUL",
                            transactionId: newUuid,
                        });
                    } else {
                        console.log(`Received transaction status: ${data.status}`);
                        resolve(defaultResult);
                    }
                }
            });
        });
    }
    try {
        const [firstname, lastname] = fullname.split(' ');
        const networkLowerCase = network.toLowerCase();
        const QOS_string = networkLowerCase === "mtn" ? process.env.QOS_STRING_FOR_MTN_PAYMENT : process.env.QOS_STRING_FOR_MOOV_PAYMENT;
        const QOS_username = networkLowerCase === "mtn" ? process.env.QOS_USERNAME1 : process.env.QOS_USERNAME2;
        const QOS_password = process.env.QOS_PASSWORD;
        const QOS_string_check_transaction = process.env.QOS_STRING_CHECK_TRANSACTION;
        const QOS_clientid = networkLowerCase === "mtn" ? process.env.QOS_CLIENTID1 : process.env.QOS_CLIENTID2;





        // Initial payment request
        const response = await fetch(QOS_string, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: "Basic " + Buffer.from(`${QOS_username}:${QOS_password}`).toString('base64'),
            },
            body: JSON.stringify({
                msisdn: `229${momoNumber}`,
                amount: amount,
                firstname: firstname,
                lastname: lastname || firstname,
                transref: newUuid,
                clientid: QOS_clientid,
            }),
        });
        let response2;
        try {
            response2 = await response.json(); // Try parsing the response as JSON
            console.log(response2, "Initial response");

            if (response2.responsemsg !== "PENDING" && response2.responsemsg !== "SUCCESSFUL") {
                return {
                    status: "Failed",
                    transactionId: newUuid
                };
            }
        } catch (error) {
            // Handle the case where response is not JSON or parsing fails
            console.error("Failed to parse response as JSON:", error);
            return {
                status: "Failed",
                transactionId: newUuid
            };
        }
        const transactionData = await waitForTransactionUpdate(newUuid);

        if (transactionData.status === null) {
            // // Polling transaction status
            const data = await pollTransactionStatus(
                QOS_string_check_transaction,
                QOS_username,
                QOS_password,
                QOS_clientid,
                newUuid
            );
            console.log(data, newUuid, "print1")
        return {
            status: data,
            transactionId: newUuid
        };
        }
        console.log(transactionData.status, transactionData.transactionId, "print2")
        return {
            status: transactionData.status,
            transactionId: transactionData.transactionId
        };
    } catch (error) {
        console.error('Error making payment request:', error);
        throw new Error('Payment request failed');
    }
}

async function pollTransactionStatus(url, username, password, clientid, transref) {
            try {
                const checkStatus = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Basic " + Buffer.from(`${username}:${password}`).toString('base64'),
                    },
                    body: JSON.stringify({ clientid, transref }),
                });

                const statusData = await checkStatus.json();
                if (statusData.responsemsg === "SUCCESSFUL") {
                    return "SUCCESSFUL"
                } else if (statusData.responsemsg !== "PENDING") {
                    return "FAILED"
                }
            } catch (error) {
                console.error('Error checking transaction status:', error);
                return 'PENDING'
            }

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