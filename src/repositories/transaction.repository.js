const { Op } = require('sequelize')
const { Transaction } = require('../models')

const create = (attrs, options = {}) => Transaction.create(attrs, options)
const findById = (id, options = {}) => Transaction.findByPk(id, options)
const findByReference = (reference, fundingType, options = {}) =>
  Transaction.findOne({ where: { reference, ...(fundingType ? { fundingType } : {}) }, ...options })
const findByIdempotencyKey = (userId, idempotencyKey, options = {}) =>
  Transaction.findOne({ where: { userId, idempotencyKey }, ...options })

const listByUser = (userId, { limit = 200, fundingTypes } = {}) =>
  Transaction.findAll({
    where: { userId, ...(fundingTypes ? { fundingType: { [Op.in]: fundingTypes } } : {}) },
    order: [['registeredAt', 'DESC']],
    limit
  })

/** Duplicate-deposit rule: same bet id and amount, already Successful inside the window. */
const findRecentSuccessfulDeposit = (betId, amount, since, options = {}) =>
  Transaction.findOne({
    where: { fundingType: 'deposits', status: 'Successful', betId, totalAmount: amount, completedAt: { [Op.gte]: since } },
    ...options
  })

/**
 * Settle a Pending transaction exactly once. The WHERE status = 'Pending' guard means that
 * when two workers race (webhook + poller, retry + original), only one update succeeds.
 * Returns the updated row, or null when somebody else already settled it.
 */
async function settlePending (id, changes, options = {}) {
  const [count, rows] = await Transaction.update(changes, {
    where: { id, status: 'Pending' },
    returning: true,
    ...options
  })
  return count ? rows[0] : null
}

const update = async (id, changes, options = {}) => {
  const [count, rows] = await Transaction.update(changes, { where: { id }, returning: true, ...options })
  return count ? rows[0] : null
}

const listPending = (limit = 100) =>
  Transaction.findAll({ where: { status: 'Pending' }, order: [['registeredAt', 'ASC']], limit })

module.exports = { create, findById, findByReference, findByIdempotencyKey, listByUser, findRecentSuccessfulDeposit, settlePending, update, listPending }
