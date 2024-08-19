const { Expo } = require("expo-server-sdk");
const expo = new Expo();

const { io, connectedUsers } = require("../api/index");
const sendNotification = async (to, from, type, message, time) => {
  const socketId = connectedUsers.get(to._id.toString());

  let messages = [
    {
      to: to.pushToken, // Example token
      title:
        type === "like"
          ? "A user liked your post"
          : type === "follow"
          ? "A user followed you"
          : type === "comment"
          ? "A user commented on your post"
          : "", // Notification title
      body: message, // Notification body
    },
  ];
  try {
    let ticketChunk = await expo.sendPushNotificationsAsync(messages);
  } catch (error) {}
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
