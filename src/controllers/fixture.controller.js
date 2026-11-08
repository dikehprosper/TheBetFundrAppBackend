const fixtures = require('../service/fixture.service')
const { asyncHandler } = require('../utils/handlers')

const respond = (message) => (result) => ({ success: true, message, data: result.data })
const make = (fn, message) => asyncHandler(async (req, res) => res.status(200).json(respond(message)(await fn(req))))

module.exports = {
  getFixturesForADate: make((req) => fixtures.fixturesForDate(req.query.date), 'Fixtures fetched'),
  getLeagues: make(() => fixtures.leagues(), 'Leagues returned'),
  getEvents: make((req) => fixtures.events(req.query.fixture), 'Events fetched'),
  getLineups: make((req) => fixtures.lineups(req.query.fixture), 'Lineups fetched'),
  getStandings: make((req) => fixtures.standings(req.query.league, req.query.season), 'Standings returned'),
  getStatistics: make((req) => fixtures.statistics(req.query.fixture), 'Statistics fetched'),
  getGame: asyncHandler(async (req, res) => res.status(200).json({ success: true, message: 'Game data returned', data: await fixtures.game(req.query.h2h, req.query.date) }))
}
