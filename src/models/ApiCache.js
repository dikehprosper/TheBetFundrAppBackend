const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const ApiCache = sequelize.define('ApiCache', {
  kind: { type: DataTypes.TEXT, primaryKey: true },
  cacheKey: { type: DataTypes.TEXT, primaryKey: true },
  payload: { type: DataTypes.JSONB, allowNull: false },
  fetchedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: 'api_cache', timestamps: false })

module.exports = ApiCache
