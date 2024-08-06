const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  type: { type: String, required: true },
  description: { type: String, required: true },
  to: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Notification", notificationSchema);
