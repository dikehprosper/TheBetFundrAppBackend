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

const router = express.Router();

router.get("/", getFixturesForADate);
router.get("/leagues", getLeagues);
router.get("/events", getEvents);
router.get("/lineups", getLineups);
router.get("/standings", getStandings);
router.get("/game", getGame);
router.get("/statistics", getStatistics);

module.exports = router;
