const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  fixture: { type: Number, required: true },
  events: { type: Array, required: true },
});

module.exports = mongoose.model("Event", eventSchema);
