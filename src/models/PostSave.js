const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PostSave = sequelize.define('PostSave', {
  postId: { type: DataTypes.UUID, primaryKey: true },
  userId: { type: DataTypes.UUID, primaryKey: true }
}, { tableName: 'post_saves', updatedAt: false })

module.exports = PostSave
