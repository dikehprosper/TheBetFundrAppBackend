const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PaymentEvent = sequelize.define('PaymentEvent', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  provider: { type: DataTypes.TEXT, allowNull: false },
  reference: { type: DataTypes.TEXT, allowNull: false },
  reportedStatus: { type: DataTypes.TEXT },
  raw: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: 'payment_events', timestamps: false })

module.exports = PaymentEvent
