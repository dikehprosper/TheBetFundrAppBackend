const { PredictionLeague, PredictionTeam, MatchPrediction } = require('../models')
const providers = require('./providers')
const { AppError } = require('../utils/handlers')
const { prepareImage } = require('./image.service')

/**
 * Admin-curated predictions: leagues, teams and match tips (two parallel tip lists, 1 and 2).
 * Only admins may write (the old API let any logged-in user create and delete).
 */
async function storeImage (file, folder) {
  if (!file) return { url: '', fileName: '' }
  const buffer = await prepareImage(file.buffer, { width: 256, height: 256, fit: 'inside' })
  return providers.storage.save({ buffer, originalName: file.originalname || 'image.webp', contentType: 'image/webp', folder })
}

async function createLeague ({ league, file }) {
  const exists = await PredictionLeague.findOne({ where: { league } })
  if (exists) throw new AppError(409, 'League already exists')
  const image = await storeImage(file, 'leagues')
  return PredictionLeague.create({ league, image: image.url })
}

async function createTeam ({ team, file }) {
  const exists = await PredictionTeam.findOne({ where: { team } })
  if (exists) throw new AppError(409, 'Team already exists')
  const image = await storeImage(file, 'teams')
  return PredictionTeam.create({ team, image: image.url })
}

const listLeagues = () => PredictionLeague.findAll({ order: [['league', 'ASC']] })
const listTeams = () => PredictionTeam.findAll({ order: [['team', 'ASC']] })

async function deleteById (Model, id, label) {
  const row = await Model.findByPk(id)
  if (!row) throw new AppError(404, `${label} not found`)
  await row.destroy()
  return row
}

const createMatch = (listNo, data) => MatchPrediction.create({ listNo, ...data })
async function updateMatch (listNo, id, data) {
  const row = await MatchPrediction.findOne({ where: { id, listNo } })
  if (!row) throw new AppError(404, 'Match prediction not found')
  return row.update(data)
}
const deleteMatch = async (listNo, id) => {
  const row = await MatchPrediction.findOne({ where: { id, listNo } })
  if (!row) throw new AppError(404, 'Match prediction not found')
  await row.destroy()
  return row
}
const listMatches = (listNo) => MatchPrediction.findAll({ where: { listNo }, order: [['matchDate', 'DESC'], ['time', 'ASC']] })

module.exports = {
  createLeague, createTeam, listLeagues, listTeams,
  deleteLeague: (id) => deleteById(PredictionLeague, id, 'League'),
  deleteTeam: (id) => deleteById(PredictionTeam, id, 'Team'),
  createMatch, updateMatch, deleteMatch, listMatches
}
