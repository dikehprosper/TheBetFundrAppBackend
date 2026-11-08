const { DataTypes } = require('sequelize')
const { sequelize } = require('../config/database.config')

// Append-only (enforced by a database trigger).
const LedgerEntry = sequelize.define('LedgerEntry', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.UUID, allowNull: false },
  transactionId: { type: DataTypes.UUID },
  entryType: { type: DataTypes.TEXT, allowNull: false },
  amount: { type: DataTypes.DECIMAL(20, 4), allowNull: false },
  balanceAfter: { type: DataTypes.DECIMAL(20, 4), allowNull: false }
}, { tableName: 'ledger_entries', updatedAt: false })

module.exports = LedgerEntry
