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
const io = new Server(server);

require("dotenv").config();

// Apply CORS to allow all origins
app.use(cors());
app.use(express.json());

// Routes
const post = require("../routes/post");
const fixtures = require("../routes/fixtures");
const authRoutes = require("../routes/userAuth");
const authRoutesWithoutToken = require("../routes/userAuthWithoutToken");
const editProfileRoutes = require("../routes/editProfile");
const sendNotificationRoutes = require("../routes/sendNotifications");
const genarateQRCodeRoutes = require("../routes/QRCode");
const actionRoutes = require("../routes/action");
const verifyToken = require("../verifyToken");

// Welcome route
app.get("/", (req, res) => {
  res.send("Welcome to express");
});

io.on("connection", (socket) => {
  console.log("user connected");
  socket.on("fixtures", (msg) => {
    console.log("fixtures updated")
    io.emit("fixtures", msg);
  });
});

app.post("/emit-fixtures", (req, res)=> {
  const {data} = req.body
  io.emit("fixtures", data)
  res.sendStatus(200)
})

app.use("/api/posts", verifyToken, post);
app.use("/api/users", verifyToken, editProfileRoutes);
app.use("/api/users", verifyToken, sendNotificationRoutes);
app.use("/api/users", verifyToken, genarateQRCodeRoutes);
app.use("/api/users", verifyToken, actionRoutes);
app.use("/api/usersWithoutToken", authRoutesWithoutToken);
app.use("/api/fixtures", fixtures);

// MongoDB connection and server start
const port = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    server.listen(port, () => console.log(`Server is running on port ${port}`));
  })
  .catch((err) => console.log(err));
