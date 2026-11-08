const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fullname: { type: DataTypes.TEXT, allowNull: false },
  email: { type: DataTypes.TEXT, allowNull: false },
  passwordHash: { type: DataTypes.TEXT, allowNull: false },
  pinHash: { type: DataTypes.TEXT },
  pinState: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  betId: { type: DataTypes.TEXT },
  phoneNumber: { type: DataTypes.TEXT },
  tag: { type: DataTypes.TEXT },
  role: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'user' },
  isSubAdminDeposits: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isSubAdminWithdrawals: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isActivated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  isLoggedIn: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sessionId: { type: DataTypes.UUID },
  deleteRequestState: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  image: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  imageFileName: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  pushToken: { type: DataTypes.TEXT },
  expoPushToken: { type: DataTypes.TEXT },
  colorScheme: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 2 },
  fedapayId: { type: DataTypes.BIGINT },
  referrerId: { type: DataTypes.UUID },
  bonusBalance: { type: DataTypes.DECIMAL(20, 4), allowNull: false, defaultValue: '0' },
  restrictedBonusBalance: { type: DataTypes.DECIMAL(20, 4), allowNull: false, defaultValue: '0' },
  successfulDepositCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  successfulWithdrawalCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  resetCodeHash: { type: DataTypes.TEXT },
  resetCodeExpiresAt: { type: DataTypes.DATE },
  resetCodeAttempts: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
  registeredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, { tableName: 'users' })

module.exports = User
