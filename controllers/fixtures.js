/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const {
  getFixturesForDate,
  getLeaguesData,
  getEventsData,
  getLineupsData,
  getStandingsData,
  getGameData,
  getStatisticsData,
} = require("../utils/sportsApi");
const moment = require("moment");
const Fixtures = require("../models/fixtures");
const Leagues = require("../models/leagues");
const Standings = require("../models/standings");
const Lineups = require("../models/lineup");
const Statistics = require("../models/statistics");
const Events = require("../models/event");

const { liveStatus, finishedStatus } = require("../helpers/fixtures");

const getFixturesForADate = async (req, res) => {
  const date = req.query.date;
  const lastCall = new Date();

  try {
    const fixtures = await Fixtures.findOne({ date });

    if (fixtures) {
      return res.status(200).json({
        success: true,
        message: "Fixtures fetched",
        data: fixtures.fixtures,
      });
    }
    const {
      data: { response },
    } = await getFixturesForDate(date);

    const createdFixtures = await Fixtures.create({
      date,
      fixtures: response,
      lastCall,
    });

    return res.status(200).json({
      success: true,
      message: "Fixtures fetched",
      data: response,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error: error });
  }
};

const getLeagues = async (req, res) => {
  const date = req.query.date;
  try {
    const lastCall = new Date();
    const leagues = await Leagues.findOne({ title: "leagueList" });
    const fixtures = await Fixtures.findOne({ date });

    if (!fixtures) {
      const {
        data: { response: fixturesResponse },
      } = await getFixturesForDate(date);
      await Fixtures.create({ date, fixtures: fixturesResponse, lastCall });
    }

    if (leagues) {
      const currentDate = moment();
      const lastCallDate = moment(leagues.lastCall);

      const duration = currentDate.diff(lastCallDate, "minute");

      if (duration < 60) {
        return res.status(200).json({
          success: true,
          message: "Leagues returned",
          data: leagues.leagues,
        });
      }
    }

    const {
      data: { response },
    } = await getLeaguesData();

    await Leagues.findOneAndUpdate(
      { title: "leagueList" },
      {
        $set: {
          leagues: response.slice(0, 50),
        },
      },
      {
        upsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Leagues fetched",
      data: response.slice(0, 50),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getEvents = async (req, res) => {
  const fixture = req.query.fixture;

  try {
    const event = await Events.findOne({ fixture: Number(fixture) });

    if (event) {
      return res
        .status(200)
        .json({ success: true, message: "Events fetched", data: event.events });
    }

    const {
      data: { response },
    } = await getEventsData(fixture);

    await Events.create({ fixture: Number(fixture), events: response });

    return res
      .status(200)
      .json({ success: true, message: "Events fetched", data: response });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getLineups = async (req, res) => {
  const fixture = req.query.fixture;

  try {
    const lineup = await Lineups.findOne({ fixture: Number(fixture) });

    if (lineup)
      return res.status(200).json({
        success: true,
        message: "Lineups fetched",
        data: lineup.lineups,
      });
    const {
      data: { response },
    } = await getLineupsData(fixture);

    await Lineups.create({ fixture: Number(fixture), lineups: response });

    return res
      .status(200)
      .json({ success: true, message: "Lineups fetched", data: response });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getStandings = async (req, res) => {
  const league = req.query.league;
  const season = req.query.season;

  try {
    const standings = await Standings.findOne({ league, season });

    if (standings) {
      const lastCallDate = moment(standings.lastCall);
      const currentDate = moment();
      const duration = currentDate.diff(lastCallDate, "hour");

      if (duration < 12) {
        return res.status(200).json({
          success: true,
          message: "Standings returned",
          data: standings.standings,
        });
      }
    }

    const {
      data: { response },
    } = await getStandingsData(league, season);

    const date = new Date();
    await Standings.create({
      league,
      season,
      standings: response,
      lastCall: date,
    });

    return res.status(200).json({
      success: true,
      message: "Season standings retrieved",
      data: response[0],
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getGame = async (req, res) => {
  const h2h = req.query.h2h;
  const date = req.query.date;

  try {
    const {
      data: { response },
    } = await getGameData(h2h, date);

    const gameData = response[0];
    await Fixtures.findOneAndUpdate(
      { date, "fixtures.fixture.id": gameData.fixture.id },
      {
        $set: {
          "fixtures.$.fixture": gameData.fixture,
          "fixtures.$.league": gameData.league,
          "fixtures.$.teams": gameData.teams,
          "fixtures.$.goals": gameData.goals,
          "fixtures.$.score": gameData.score,
        },
      },
    );

    return res
      .status(200)
      .json({ success: true, message: "Game data returned", data: gameData });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getStatistics = async (req, res) => {
  const fixture = req.query.fixture;

  try {
    const statistics = await Statistics.findOne({ fixture: Number(fixture) });

    if (statistics)
      return res.status(200).json({
        success: true,
        message: "Statistics fetched",
        data: statistics.statistics,
      });

    const {
      data: { response },
    } = await getStatisticsData(fixture);

    await Statistics.create({ fixture: Number(fixture), statistics: response });

    return res.status(200).json({
      success: true,
      message: "Game statistics fetched",
      data: response,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

module.exports = {
  getFixturesForADate,
  getLeagues,
  getEvents,
  getLineups,
  getStandings,
  getGame,
  getStatistics,
};
