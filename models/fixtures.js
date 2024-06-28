const mongoose = require("mongoose");

const fixturesSchema = new mongoose.Schema({
  fixtures: { type: Array, required: true },
  date: { type: String, required: true },
  lastCall: { type: Date, required: true },
});

module.exports = mongoose.model("Fixtures", fixturesSchema);
