const { LedgerEntry } = require('../models')

const append = (entry, options = {}) => LedgerEntry.create(entry, options)
const listByUser = (userId, limit = 100) => LedgerEntry.findAll({ where: { userId }, order: [['id', 'DESC']], limit })
const listByTransaction = (transactionId) => LedgerEntry.findAll({ where: { transactionId }, order: [['id', 'ASC']] })

module.exports = { append, listByUser, listByTransaction }
