/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express');
const router = express.Router();
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

// Function to send push notifications
const sendNotification = async () => {
    // Array containing messages
    let messages = [{
        to: 'ExponentPushToken[FY5Xl6KBOWpf40g6ddVeKa]',  // Example token
        title: "sdjcjscdsknbcknd",  // Notification title
        body: "jdnjvkndnvjknv"  // Notification body
    }];

    // Call sendPushNotificationsAsync with the messages array
    try {
        let ticketChunk = await expo.sendPushNotificationsAsync(messages);
        console.log('Tickets:', ticketChunk);  // Log the tickets to see the response
    } catch (error) {
        console.error('Error sending notification:', error);
    }
};

// Call the function to send the notification
// sendNotification();


module.exports = router;