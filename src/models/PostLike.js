const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PostLike = sequelize.define('PostLike', {
  postId: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName: 'post_likes', updatedAt: false })

module.exports = PostLike
