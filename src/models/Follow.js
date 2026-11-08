const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const Follow = sequelize.define('Follow', {
  followerId: { type: DataTypes.UUID, primaryKey: true },
  followingId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName: 'follows', updatedAt: false })

module.exports = Follow
