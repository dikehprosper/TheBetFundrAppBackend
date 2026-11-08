const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const Post = sequelize.define('Post', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  body: { type: DataTypes.TEXT }
}, { tableName: 'posts' })

module.exports = Post
