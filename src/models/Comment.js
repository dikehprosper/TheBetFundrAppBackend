const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  postId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.UUID, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false }
}, { tableName: 'comments' })

module.exports = Comment
