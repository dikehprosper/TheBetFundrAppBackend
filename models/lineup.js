const mongoose = require("mongoose");

const lineupSchema = new mongoose.Schema({
  fixture: { type: Number, required: true },
  lineups: { type: Array, required: true },
});

module.exports = mongoose.model("Lineup", lineupSchema);
