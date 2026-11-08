const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const MatchPrediction = sequelize.define('MatchPrediction', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listNo: { type: DataTypes.SMALLINT, allowNull: false },
  team1: { type: DataTypes.TEXT, allowNull: false },
  team1Flag: { type: DataTypes.TEXT },
  team2: { type: DataTypes.TEXT, allowNull: false },
  team2Flag: { type: DataTypes.TEXT },
  league: { type: DataTypes.TEXT, allowNull: false },
  leagueFlag: { type: DataTypes.TEXT },
  tip: { type: DataTypes.TEXT, allowNull: false },
  matchDate: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  time: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.TEXT, allowNull: false }
}, { tableName: 'match_predictions' })

module.exports = MatchPrediction
