const { Expo } = require("expo-server-sdk");
const expo = new Expo();

const { io, connectedUsers } = require("../api/index");
const sendNotification = async (to, from, type, message, time) => {
  const socketId = connectedUsers.get(to._id.toString());

  let messages = [
    {
      to: to.pushToken, // Example token
      title: "sdjcjscdsknbcknd", // Notification title
      body: "jdnjvkndnvjknv", // Notification body
    },
  ];
  try {
    let ticketChunk = await expo.sendPushNotificationsAsync(messages);
    console.log("Tickets:", ticketChunk); // Log the tickets to see the response
  } catch (error) {
    console.error("Error sending notification:", error);
  }
  if (socketId) {
    io.to(socketId).emit("notification", {
      to: to._id,
      from,
      type,
      message,
      createdAt: time,
    });
  }
};

module.exports = { sendNotification };
