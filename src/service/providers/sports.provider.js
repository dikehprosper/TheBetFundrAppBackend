const { fetchWithTimeout } = require('./http')

/** API-Sports (football). The key comes from the environment: the old code had it hardcoded in source. */
const BASE = 'https://v3.football.api-sports.io/'

async function get (path) {
  if (!process.env.API_SPORTS_KEY) {
    const error = new Error('API_SPORTS_KEY is not configured')
    error.status = 503
    throw error
  }
  const response = await fetchWithTimeout(`${BASE}${path}`, { headers: { 'x-apisports-key': process.env.API_SPORTS_KEY } }, 20000)
  if (!response.ok) {
    const error = new Error(`sports provider answered ${response.status}`)
    error.status = 502
    throw error
  }
  const body = await response.json()
  return body.response
}

const q = encodeURIComponent
module.exports = {
  fixturesForDate: (date) => get(`fixtures?date=${q(date)}`),
  leagues: () => get('leagues'),
  standings: (league, season) => get(`standings?league=${q(league)}&season=${q(season)}`),
  headToHead: (h2h, date) => get(`fixtures/headtohead?h2h=${q(h2h)}&date=${q(date)}`),
  events: (fixture) => get(`fixtures/events?fixture=${q(fixture)}`),
  lineups: (fixture) => get(`fixtures/lineups?fixture=${q(fixture)}`),
  statistics: (fixture) => get(`fixtures/statistics?fixture=${q(fixture)}`)
}
