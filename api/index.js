/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const cors = require("cors");
const { createServer } = require("http");
const app = express();
const server = createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

require("dotenv").config();

// Apply CORS to allow all origins
app.use(cors());
app.use(express.json({ limit: "10000kb" }));

// Routes
const post = require("../routes/post");
const fixtures = require("../routes/fixtures");
const authRoutes = require("../routes/userAuth");
const authRoutesWithoutToken = require("../routes/userAuthWithoutToken");
const editProfileRoutes = require("../routes/editProfile");
const sendNotificationRoutes = require("../routes/sendNotifications");
const genarateQRCodeRoutes = require("../routes/QRCode");
const actionRoutes = require("../routes/action");
const userActionRoutes = require("../routes/userAction");
const verifyToken = require("../verifyToken");
const { getNotifications } = require("../controllers/notification");
const connectedUsers = new Map();

// Welcome route
app.get("/", (req, res) => {
  res.send("Welcome to express");
});

io.on("connection", (socket) => {
  console.log("user connected");

  socket.on("fixtures", (msg) => {
    console.log("fixtures updated");
    io.emit("fixtures", msg);
  });
  socket.on("live games", (msg) => {
    io.emit("live games", msg);
  });

  socket.on("authenticate", (userId) => {
    connectedUsers.set(userId, socket.id);
  });

  socket.on("disconnect", () => {
    // Remove user from connectedUsers when they disconnect
    for (let [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        break;
      }
    }
  });
});

function sendNotification(to, from, type, message, time) {
  const socketId = connectedUsers.get(to);
  if (socketId) {
    io.to(socketId).emit("notification", {
      to,
      from,
      type,
      message,
      createdAt: time,
    });
  }
}

app.post("/emit-live-games", (req, res) => {
  const { data } = req.body;
  io.emit("live games", { liveFixtures: data });
  res.sendStatus(200);
});

app.post("/emit-fixtures", (req, res) => {
  const { data } = req.body;
  io.emit("fixtures", { fixture: data });
  res.sendStatus(200);
});

app.get("/api/notifications", verifyToken, getNotifications);

app.use("/api/posts", verifyToken, post);
app.use("/api/users", verifyToken, editProfileRoutes);
app.use("/api/users", verifyToken, sendNotificationRoutes);
app.use("/api/users", verifyToken, genarateQRCodeRoutes);
app.use("/api/users", verifyToken, actionRoutes);
app.use("/api/users", verifyToken, authRoutes);
app.use("/api/usersWithoutToken", authRoutesWithoutToken);
app.use("/api/fixtures", fixtures);
app.use("/api/users/actions", verifyToken, userActionRoutes);
app.use("/api/usersWithoutToken", authRoutesWithoutToken);

// MongoDB connection and server start
const port = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(port, () => console.log(`Server is running on port ${port}`));
  })
  .catch((err) => console.log(err));

module.exports = { io, sendNotification };
