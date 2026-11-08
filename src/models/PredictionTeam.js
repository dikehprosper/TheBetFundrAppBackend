const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PredictionTeam = sequelize.define('PredictionTeam', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  team: { type: DataTypes.TEXT, allowNull: false },
  image: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' }
}, { tableName: 'prediction_teams', updatedAt: false })

module.exports = PredictionTeam
