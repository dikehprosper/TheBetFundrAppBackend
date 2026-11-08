const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const AccountDeletionRequest = sequelize.define('AccountDeletionRequest', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  email: { type: DataTypes.TEXT, allowNull: false },
  state: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  requestedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: 'account_deletion_requests', timestamps: false })

module.exports = AccountDeletionRequest
