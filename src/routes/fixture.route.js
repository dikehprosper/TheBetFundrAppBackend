const router = require('express').Router()
const c = require('../controllers/fixture.controller')

router.get('/', c.getFixturesForADate)
router.get('/leagues', c.getLeagues)
router.get('/events', c.getEvents)
router.get('/lineups', c.getLineups)
router.get('/standings', c.getStandings)
router.get('/game', c.getGame)
router.get('/statistics', c.getStatistics)

module.exports = router
