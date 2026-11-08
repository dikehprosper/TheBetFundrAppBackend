const { sequelize, Sequelize, User } = require('../models')
const { ledgerRepository } = require('../repositories')
const { AppError } = require('../utils/handlers')
const { CODES } = require('../utils/variables.helper')

const AMOUNT_RE = /^\d{1,14}(\.\d{1,4})?$/
// PostgreSQL error codes that are safe to retry: serialization_failure, deadlock_detected.
const RETRYABLE = new Set(['40001', '40P01'])

function assertAmount (amount) {
  if (typeof amount !== 'string' || !AMOUNT_RE.test(amount) || !(Number(amount) > 0)) {
    throw new Error(`wallet amounts must be positive decimal strings, got ${JSON.stringify(amount)}`)
  }
}

/**
 * Run `work` in one database transaction. Everything inside commits together or rolls back
 * together. Deadlocks and serialization failures are retried a few times.
 */
async function runInTransaction (work, { isolationLevel } = {}) {
  let attempt = 0
  for (;;) {
    try {
      return await sequelize.transaction(
        { isolationLevel: isolationLevel || Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        work
      )
    } catch (error) {
      const code = error && ((error.parent && error.parent.code) || error.code)
      if (RETRYABLE.has(code) && attempt < 3) {
        attempt += 1
        continue
      }
      throw error
    }
  }
}

/**
 * The single place a wallet balance changes.
 *
 * One guarded UPDATE both checks and applies the change. Under READ COMMITTED PostgreSQL
 * row-locks the user, waits for concurrent writers, then re-evaluates the WHERE clause on the
 * latest committed balance. Two concurrent debits can therefore never both spend the same
 * money, and the CHECK (bonus_balance >= 0) constraint is a second line of defence.
 * An append-only ledger row records every change.
 */
async function applyDelta ({ userId, amount, direction, entryType, transactionId = null }, t) {
  if (!t) throw new Error('wallet changes must run inside a database transaction')
  assertAmount(amount)
  const delta = direction === 'debit' ? `-${amount}` : amount

  const rows = await sequelize.query(
    `UPDATE users
        SET bonus_balance = bonus_balance + :delta::numeric, updated_at = now()
      WHERE id = :userId AND bonus_balance + :delta::numeric >= 0
      RETURNING bonus_balance`,
    { replacements: { delta, userId }, type: sequelize.QueryTypes.SELECT, transaction: t }
  )

  if (rows.length === 0) {
    const exists = await User.findByPk(userId, { attributes: ['id'], transaction: t })
    if (!exists) throw new AppError(404, 'User not found')
    throw new AppError(506, 'wallet balance not sufficient', { code: CODES.INSUFFICIENT_FUNDS })
  }

  const balanceAfter = rows[0].bonus_balance
  await ledgerRepository.append({ userId, transactionId, entryType, amount: delta, balanceAfter }, { transaction: t })
  return balanceAfter
}

const debit = (userId, amount, entryType, transactionId, t) =>
  applyDelta({ userId, amount, direction: 'debit', entryType, transactionId }, t)
const credit = (userId, amount, entryType, transactionId, t) =>
  applyDelta({ userId, amount, direction: 'credit', entryType, transactionId }, t)

async function getBalance (userId, t) {
  const user = await User.findByPk(userId, { attributes: ['bonusBalance'], transaction: t })
  return user ? user.bonusBalance : null
}

/** Decimal-safe helpers for splitting an amount into wallet and cash portions (done in SQL). */
async function splitAgainstBalance (userId, amount, t) {
  const [row] = await sequelize.query(
    `SELECT LEAST(bonus_balance, :amount::numeric)::numeric(20,4)::text AS wallet_part,
            GREATEST(:amount::numeric - bonus_balance, 0)::numeric(20,4)::text AS cash_part,
            bonus_balance::numeric(20,4)::text AS balance
       FROM users WHERE id = :userId`,
    { replacements: { amount, userId }, type: sequelize.QueryTypes.SELECT, transaction: t }
  )
  if (!row) throw new AppError(404, 'User not found')
  return { walletPart: row.wallet_part, cashPart: row.cash_part, balance: row.balance }
}

/** Referral bonus for a deposit: amount x 3% x 33% (exact decimal maths in SQL). */
async function referralBonusFor (amount, rate, t) {
  const [row] = await sequelize.query('SELECT ROUND(:amount::numeric * :rate::numeric, 4)::text AS bonus', {
    replacements: { amount, rate },
    type: sequelize.QueryTypes.SELECT,
    transaction: t
  })
  return row.bonus
}

module.exports = { runInTransaction, applyDelta, debit, credit, getBalance, splitAgainstBalance, referralBonusFor }
