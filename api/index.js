/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */ const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const app = express();
require("dotenv").config();

// Apply CORS to allow all origins
app.use(cors());

app.use(express.json());

// Routes
const post = require("../routes/post");
const fixtures = require("../routes/fixtures");
const authRoutes = require("../routes/userAuth");
const editProfileRoutes = require("../routes/editProfile");
const sendNotificationRoutes = require("../routes/sendNotifications");
const genarateQRCodeRoutes = require("../routes/QRCode");
const actionRoutes = require("../routes/action");

const verifyToken = require("../verifyToken");

// Welcome route
app.get("/", (req, res) => {
  res.send("Welcome to express");
});

// API routes
app.use("/api/posts", post);
app.use("/api/fixtures", fixtures);
app.use("/api/users", authRoutes);
app.use("/api/users", editProfileRoutes);
app.use("/api/users", sendNotificationRoutes);
app.use("/api/users", genarateQRCodeRoutes);
app.use("/api/users", actionRoutes);

// MongoDB connection and server start
const port = process.env.PORT || 5001;
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(port, () => console.log(`Server is running on port ${port}`));
    // console.log(Date())
  })
  .catch((err) => console.log(err));
