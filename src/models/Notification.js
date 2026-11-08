const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fromUserId: { type: DataTypes.UUID, allowNull: false },
  toUserId: { type: DataTypes.UUID, allowNull: false },
  type: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  postId: { type: DataTypes.UUID }
}, { tableName: 'notifications', updatedAt: false })

module.exports = Notification
