const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const PlatformSettings = sequelize.define('PlatformSettings', {
  id: { type: DataTypes.SMALLINT, primaryKey: true, defaultValue: 1 },
  isDepositsOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isWithdrawalsOpen: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  disbursedBonusBalance: { type: DataTypes.DECIMAL(20, 4), allowNull: false, defaultValue: '0' }
}, { tableName: 'platform_settings', createdAt: false })

module.exports = PlatformSettings
