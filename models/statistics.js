const mongoose = require("mongoose");

const statisticsSchema = new mongoose.Schema({
  fixture: { type: Number, required: true },
  statistics: { type: Array, required: true },
});

module.exports = mongoose.model("Statistics", statisticsSchema);
