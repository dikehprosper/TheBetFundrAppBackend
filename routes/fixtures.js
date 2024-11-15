/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const {
  getFixturesForADate,
  getLeagues,
  getEvents,
  getLineups,
  getStandings,
  getGame,
  getStatistics,
} = require("../controllers/fixtures");
const verifyToken = require("../verifyToken");

const router = express.Router();

router.get("/", getFixturesForADate);
router.get("/leagues", getLeagues);
router.get("/events", getEvents);
router.get("/lineups", getLineups);
router.get("/standings", getStandings);
router.get("/game", getGame);
router.get("/statistics", getStatistics);

module.exports = router;
