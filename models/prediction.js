/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require("mongoose");

const PredictionLeagueSchema = new mongoose.Schema({
  league: { type: String, required: true },
  image: { type: String }
});

// Define another schema as an example (replace this with your actual schema)
const PredictionTeamSchema = new mongoose.Schema({
  team: { type: String, required: true },
  image: { type: String }
});

const MatchPredictionSchema = new mongoose.Schema({
  team1: { type: String, required: true },
  team1_flag: { type: String },
  team2: { type: String, required: true },
  team2_flag: { type: String },
  league: { type: String, required: true },
  league_flag: { type: String },
  tip: { type: String, required: true },
  createdAt: {
    type: String,
    default: () => {
      const now = new Date();
      return now.toISOString().split("T")[0]; // Formats the date as YYYY-MM-DD
    },
  },
  time: { type: String, required: true },
  status: { type: String, required: true },
});

const SecondMatchPredictionSchema = new mongoose.Schema({
  team1: { type: String, required: true },
  team1_flag: { type: String },
  team2: { type: String, required: true },
  team2_flag: { type: String },
  league: { type: String, required: true },
  league_flag: { type: String },
  tip: { type: String, required: true },
  createdAt: {
    type: String,
    default: () => {
      const now = new Date();
      return now.toISOString().split("T")[0]; // Formats the date as YYYY-MM-DD
    },
  },
  time: { type: String, required: true },
  status: { type: String, required: true },
});


// Export multiple models or schemas
module.exports = {
  PredictionLeague: mongoose.model("PredictionLeague", PredictionLeagueSchema),
  PredictionTeam: mongoose.model("PredictionTeam", PredictionTeamSchema),
  MatchPrediction: mongoose.model("MatchPrediction", MatchPredictionSchema),
  SecondMatchPrediction: mongoose.model("SecondMatchPrediction", SecondMatchPredictionSchema),

};
