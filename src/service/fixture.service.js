const { ApiCache } = require('../models')
const providers = require('./providers')
const { AppError } = require('../utils/handlers')

/**
 * Football data cache (API-Sports). Same freshness rules as the original:
 *   fixtures by date, events, lineups, statistics: kept once fetched
 *   leagues: refreshed after 60 minutes (first 50 only)     standings: refreshed after 12 hours
 */
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

const read = (kind, cacheKey) => ApiCache.findOne({ where: { kind, cacheKey } })
const write = (kind, cacheKey, payload) =>
  ApiCache.upsert({ kind, cacheKey, payload, fetchedAt: new Date() })

function requireParam (value, name) {
  if (value === undefined || value === null || String(value).trim() === '') throw new AppError(400, `${name} is required`)
  return String(value).trim()
}

async function cached (kind, cacheKey, maxAgeMs, fetcher) {
  const hit = await read(kind, cacheKey)
  if (hit && (maxAgeMs === null || Date.now() - hit.fetchedAt.getTime() < maxAgeMs)) return { data: hit.payload, fromCache: true }
  try {
    const data = await fetcher()
    await write(kind, cacheKey, data)
    return { data, fromCache: false }
  } catch (error) {
    // if the provider is down but we have an older copy, serve it rather than fail
    if (hit) return { data: hit.payload, fromCache: true, stale: true }
    throw new AppError(error.status === 503 ? 503 : 502, 'Football data is temporarily unavailable')
  }
}

const fixturesForDate = (date) => cached('fixtures', requireParam(date, 'date'), null, () => providers.sports.fixturesForDate(date))
const leagues = () => cached('leagues', 'leagueList', 60 * MINUTE, async () => (await providers.sports.leagues()).slice(0, 50))
const events = (fixture) => cached('events', requireParam(fixture, 'fixture'), null, () => providers.sports.events(fixture))
const lineups = (fixture) => cached('lineups', requireParam(fixture, 'fixture'), null, () => providers.sports.lineups(fixture))
const statistics = (fixture) => cached('statistics', requireParam(fixture, 'fixture'), null, () => providers.sports.statistics(fixture))
const standings = (league, season) =>
  cached('standings', `${requireParam(league, 'league')}:${requireParam(season, 'season')}`, 12 * HOUR, () => providers.sports.standings(league, season))

/** Fresh head-to-head for one game, written back into the cached fixture list for that date. */
async function game (h2h, date) {
  requireParam(h2h, 'h2h')
  requireParam(date, 'date')
  let response
  try {
    response = await providers.sports.headToHead(h2h, date)
  } catch (error) {
    throw new AppError(error.status === 503 ? 503 : 502, 'Football data is temporarily unavailable')
  }
  const gameData = response && response[0]
  if (!gameData) throw new AppError(404, 'Game not found')
  const entry = await read('fixtures', date)
  if (entry && Array.isArray(entry.payload)) {
    const payload = entry.payload.map((item) =>
      item && item.fixture && item.fixture.id === gameData.fixture.id
        ? { ...item, fixture: gameData.fixture, league: gameData.league, teams: gameData.teams, goals: gameData.goals, score: gameData.score }
        : item)
    await write('fixtures', date, payload)
  }
  return gameData
}

module.exports = { fixturesForDate, leagues, events, lineups, statistics, standings, game }
