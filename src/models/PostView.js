const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PostView = sequelize.define('PostView', {
  postId: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName: 'post_views', updatedAt: false })

module.exports = PostView
