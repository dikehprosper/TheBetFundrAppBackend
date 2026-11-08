const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

const money = (allowNull = false) => ({ type: DataTypes.DECIMAL(20, 4), allowNull, defaultValue: allowNull ? null : '0' })

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  reference: { type: DataTypes.TEXT, allowNull: false },
  fundingType: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.TEXT, allowNull: false },
  paymentConfirmation: { type: DataTypes.TEXT },
  userId: { type: DataTypes.UUID, allowNull: false },
  counterpartyId: { type: DataTypes.UUID },
  amount: money(),
  totalAmount: money(),
  walletAmount: money(),
  betId: { type: DataTypes.TEXT },
  momoNumber: { type: DataTypes.TEXT },
  momoName: { type: DataTypes.TEXT },
  network: { type: DataTypes.TEXT },
  service: { type: DataTypes.TEXT },
  withdrawalCode: { type: DataTypes.TEXT },
  customErrorCode: { type: DataTypes.INTEGER },
  authenticatedDeposit: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  qrCodeId: { type: DataTypes.UUID },
  provider: { type: DataTypes.TEXT },
  providerTransactionId: { type: DataTypes.TEXT },
  idempotencyKey: { type: DataTypes.TEXT },
  userEmail: { type: DataTypes.TEXT },
  senderName: { type: DataTypes.TEXT },
  recipientName: { type: DataTypes.TEXT },
  recipientTag: { type: DataTypes.TEXT },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  registeredAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  completedAt: { type: DataTypes.DATE }
}, { tableName: 'transactions' })

module.exports = Transaction
