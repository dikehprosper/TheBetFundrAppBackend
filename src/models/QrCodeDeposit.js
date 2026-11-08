const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const QrCodeDeposit = sequelize.define('QrCodeDeposit', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false },
  email: { type: DataTypes.TEXT, allowNull: false },
  fullname: { type: DataTypes.TEXT },
  betId: { type: DataTypes.TEXT, allowNull: false },
  amount: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
  service: { type: DataTypes.TEXT },
  qrcodeStatus: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Pending' },
  used: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  paymentConfirmation: { type: DataTypes.TEXT, allowNull: false, defaultValue: 'Pending' },
  validUntil: { type: DataTypes.DATE, allowNull: false }
}, { tableName: 'qr_code_deposits' })

module.exports = QrCodeDeposit
