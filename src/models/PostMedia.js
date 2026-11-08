const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PostMedia = sequelize.define('PostMedia', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  postId: { type: DataTypes.UUID, allowNull: false },
  url: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.TEXT, allowNull: false },
  position: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 }
}, { tableName: 'post_media', timestamps: false })

module.exports = PostMedia
