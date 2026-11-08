const predictions = require('../service/prediction.service')
const { asyncHandler } = require('../utils/handlers')

const ok = (res, message, extra = {}, status = 200) => res.status(status).json({ success: true, message, ...extra })

const createLeague = asyncHandler(async (req, res) => ok(res, 'League created', { league: await predictions.createLeague({ league: req.body.league, file: req.file }) }, 201))
const createTeam = asyncHandler(async (req, res) => ok(res, 'Team created', { team: await predictions.createTeam({ team: req.body.team, file: req.file }) }, 201))
const getLeague = asyncHandler(async (_req, res) => { const leagues = await predictions.listLeagues(); ok(res, 'Leagues', { leagues, data: leagues }) })
const getTeam = asyncHandler(async (_req, res) => { const teams = await predictions.listTeams(); ok(res, 'Teams', { teams, data: teams }) })
const deleteLeague = asyncHandler(async (req, res) => { await predictions.deleteLeague(req.body.id); ok(res, 'League deleted') })
const deleteTeam = asyncHandler(async (req, res) => { await predictions.deleteTeam(req.body.id); ok(res, 'Team deleted') })

const matchHandlers = (listNo) => ({
  create: asyncHandler(async (req, res) => ok(res, 'Match prediction created', { matchPrediction: await predictions.createMatch(listNo, req.body) }, 201)),
  update: asyncHandler(async (req, res) => {
    const { id, ...changes } = req.body
    ok(res, 'Match prediction updated', { matchPrediction: await predictions.updateMatch(listNo, id, changes) })
  }),
  remove: asyncHandler(async (req, res) => { await predictions.deleteMatch(listNo, req.body.id); ok(res, 'Match prediction deleted') }),
  list: asyncHandler(async (_req, res) => { const data = await predictions.listMatches(listNo); ok(res, 'Match predictions', { data, matchPredictions: data }) })
})

module.exports = { createLeague, createTeam, getLeague, getTeam, deleteLeague, deleteTeam, first: matchHandlers(1), second: matchHandlers(2) }
