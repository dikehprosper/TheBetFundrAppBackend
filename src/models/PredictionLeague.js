const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PredictionLeague = sequelize.define('PredictionLeague', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  league: { type: DataTypes.TEXT, allowNull: false },
  image: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
}, { tableName: 'prediction_leagues', updatedAt: false })

module.exports = PredictionLeague
