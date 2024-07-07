const mongoose = require("mongoose");

const fixturesSchema = new mongoose.Schema({
  fixtures: {
    type: [
      {
        fixture: mongoose.Schema.Types.Mixed,
        league: mongoose.Schema.Types.Mixed,
        teams: mongoose.Schema.Types.Mixed,
        goals: mongoose.Schema.Types.Mixed,
        score: mongoose.Schema.Types.Mixed,
      },
    ],
    required: true,
  },
  date: { type: String, required: true },
  lastCall: { type: Date, required: true },
});

module.exports = mongoose.model("Fixtures", fixturesSchema);
