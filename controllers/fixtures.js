const {
  getFixturesForDate,
  getLeaguesData,
  getEventsData,
  getLineupsData,
  getStandingsData,
  getGameData,
  getStatisticsData,
} = require("../utils/sportsApi");

const getFixturesForADate = async (req, res) => {
  const date = req.query.date;
  try {
    const {
      data: { response },
    } = await getFixturesForDate(date);

    return res
      .status(200)
      .json({ success: true, message: "Fixtures fetched", data: response });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error: error });
  }
};

const getLeagues = async (req, res) => {
  try {
    const {
      data: { response },
    } = await getLeaguesData();

    return res
      .status(200)
      .json({ success: true, message: "Leagues fetched", data: response });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getEvents = async (req, res) => {
  const fixture = req.query.fixture;
  try {
    const {
      data: { response },
    } = await getEventsData(fixture);

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
    const {
      data: { response },
    } = await getLineupsData(fixture);

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
    const {
      data: { response },
    } = await getStandingsData(league, season);

    return res.status(200).json({
      success: true,
      message: "Season standings retrieved",
      data: response,
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

    return res
      .status(200)
      .json({ success: true, message: "Game data returned", data: response });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: error.message, error });
  }
};

const getStatistics = async (req, res) => {
  const fixture = req.query.fixture;
  try {
    const {
      data: { response },
    } = await getStatisticsData(fixture);

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
