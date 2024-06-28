const axios = require("axios");

const sportsClient = axios.create({
  baseURL: "https://v3.football.api-sports.io/",
  headers: {
    "x-apisports-key": "574378eff4c6fe1ae23f0a8728502088",
  },
});

// fixtures
const getFixturesForDate = async (date) =>
  await sportsClient.get(`fixtures?date=${date}`);

// leagues
const getLeaguesData = async () => await sportsClient.get(`leagues`);

// events
const getEventsData = async (fixture) =>
  await sportsClient.get(`fixtures/events?fixture=${fixture}`);

module.exports = { getFixturesForDate, getLeaguesData, getEventsData };