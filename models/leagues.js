const mongoose = require("mongoose");

const leaguesSchema = new mongoose.Schema({
  title: { type: String, default: "leagueList" },
  leagues: { type: Array, required: true },
  lastCall: { type: Date, required: true },
});

module.exports = mongoose.model("Leagues", leaguesSchema);
