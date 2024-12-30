const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  fixture: mongoose.Schema.Types.Mixed,
  league: mongoose.Schema.Types.Mixed,
  teams: mongoose.Schema.Types.Mixed,
  goals: mongoose.Schema.Types.Mixed,
  score: mongoose.Schema.Types.Mixed,
});

module.exports = mongoose.model("Game", gameSchema);
