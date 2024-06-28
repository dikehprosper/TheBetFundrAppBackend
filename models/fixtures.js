const mongoose = require("mongoose");

const fixturesSchema = new mongoose.Schema({
  fixturesList: { type: Array, required: true },
  lastCall: { type: Date, required: true },
});

module.export = mongoose.model("Fixtures", fixturesSchema);
