const {
  getFixturesForDate,
  getLeaguesData,
  getEventsData,
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

module.exports = { getFixturesForADate, getLeagues, getEvents };
