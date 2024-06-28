const mongoose = require("mongoose");

const standingsSchema = new mongoose.Schema({
  season: { type: String, required: true },
  league: { type: String, required: true },
  standings: { type: Array, required: true },
  lastCall: { type: Date, required: true },
});

module.exports = mongoose.model("Standings", standingsSchema);
