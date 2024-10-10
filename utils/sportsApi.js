/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
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

// standings
const getStandingsData = async (league, season) =>
  await sportsClient.get(`standings?league=${league}&season=${season}`);

// game data
const getGameData = async (h2h, date) =>
  await sportsClient.get(`fixtures/headtohead?h2h=${h2h}&date=${date}`);
const getEventsData = async (fixture) =>
  await sportsClient.get(`fixtures/events?fixture=${fixture}`);
const getLineupsData = async (fixture) =>
  await sportsClient.get(`fixtures/lineups?fixture=${fixture}`);
const getStatisticsData = async (fixture) =>
  await sportsClient.get(`fixtures/statistics?fixture=${fixture}`);

module.exports = {
  getFixturesForDate,
  getLeaguesData,
  getEventsData,
  getLineupsData,
  getStandingsData,
  getGameData,
  getStatisticsData,
};
