const express = require("express");
const {
  getFixturesForADate,
  getLeagues,
  getEvents,
} = require("../controllers/fixtures");

const router = express.Router();

router.get("/", getFixturesForADate);
router.get("/leagues", getLeagues);
router.get("/events", getEvents);

module.exports = router;
