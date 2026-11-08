const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const UserBetId = sequelize.define('UserBetId', {
  userId: { type: DataTypes.UUID, primaryKey: true },
  betId: { type: DataTypes.TEXT, primaryKey: true }
}, { tableName: 'user_bet_ids', updatedAt: false })

module.exports = UserBetId
