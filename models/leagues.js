const mongoose = require("mongoose");

const leaguesSchema = new mongoose.Schema({
  leagueList: { type: Array, required: true },
  lastCall: { type: Date, required: true },
});

modules.export = mongoose.model("Leagues", leaguesSchema);
