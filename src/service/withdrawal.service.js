const { userRepository, transactionRepository, settingsRepository } = require('../repositories')
const wallet = require('./wallet.service')
const providers = require('./providers')
const { notifyMoneyEvent } = require('./notification.service')
const { sendTemplate } = require('../utils/helpers/mail.helper')
const { generateReference } = require('../utils/helpers/ids.helper')
const { AppError } = require('../utils/handlers')
const logger = require('../config/logger.config')
const V = require('../utils/variables.helper')

/**
 * WITHDRAWAL requests, two kinds (both end Pending: staff pay the customer out):
 *
 *  wallet   - the customer cashes out money held in their wallet. The wallet is debited
 *             immediately, in the same database transaction that records the request.
 *  account  - the customer redeems a withdrawal CODE generated on their betting account.
 *             The cashdesk tells us the amount (Summa).
 *
 * The same integrity rules as deposits apply: debit and record together, never refund on an
 * unknown provider outcome, replay-safe through the idempotency key.
 */
const UNIQUE_VIOLATION = '23505'

async function assertOpenAndUsable (user) {
  const settings = await settingsRepository.get()
  if (settings.isWithdrawalsOpen === false) throw new AppError(405, 'We are currently under maintainance')
  if (!user) throw new AppError(401, 'User not found')
  if (!user.isActivated) throw new AppError(502, 'User is deactivated')
}

async function replayIfAny (userId, key, t) {
  if (!key) return null
  return transactionRepository.findByIdempotencyKey(userId, key, t ? { transaction: t } : {})
}

async function withdrawFromWallet ({ user, amount, betId, momoNumber, service, idempotencyKey }) {
  try {
    const { transaction, replay } = await wallet.runInTransaction(async (t) => {
      const existing = await replayIfAny(user.id, idempotencyKey, t)
      if (existing) return { transaction: existing, replay: true }
      const created = await transactionRepository.create({
        reference: generateReference(),
        fundingType: V.FUNDING_TYPE.WITHDRAWALS,
        status: V.TRANSACTION_STATUS.PENDING,
        paymentConfirmation: 'Successful',
        userId: user.id,
        amount: '0',
        totalAmount: amount,
        walletAmount: amount,
        betId,
        momoNumber,
        service,
        provider: 'wallet',
        idempotencyKey: idempotencyKey || null,
        userEmail: user.email
      }, { transaction: t })
      await wallet.debit(user.id, amount, V.LEDGER.WITHDRAWAL_HOLD, created.id, t)
      return { transaction: created, replay: false }
    })
    if (!replay) afterPending(user, transaction)
    return { transaction, outcome: 'pending-complete', replay }
  } catch (error) {
    if (error && error.parent && error.parent.code === UNIQUE_VIOLATION && idempotencyKey) {
      const existing = await transactionRepository.findByIdempotencyKey(user.id, idempotencyKey)
      if (existing) return { transaction: existing, outcome: 'pending-complete', replay: true }
    }
    throw error
  }
}

async function withdrawFromAccount ({ user, betId, withdrawalCode, momoNumber, service, idempotencyKey }) {
  const existing = await replayIfAny(user.id, idempotencyKey)
  if (existing) return { transaction: existing, outcome: existing.status === 'Failed' ? 'failed' : 'pending-incomplete', replay: true }

  let transaction
  try {
    transaction = await transactionRepository.create({
      reference: generateReference(),
      fundingType: V.FUNDING_TYPE.WITHDRAWALS,
      status: V.TRANSACTION_STATUS.PENDING,
      paymentConfirmation: 'Pending',
      userId: user.id,
      amount: '0',
      totalAmount: '0',
      walletAmount: '0',
      betId,
      momoNumber,
      service,
      withdrawalCode,
      provider: 'cashdesk',
      idempotencyKey: idempotencyKey || null,
      userEmail: user.email
    })
  } catch (error) {
    if (error && error.parent && error.parent.code === UNIQUE_VIOLATION && idempotencyKey) {
      const raced = await transactionRepository.findByIdempotencyKey(user.id, idempotencyKey)
      if (raced) return { transaction: raced, outcome: 'pending-incomplete', replay: true }
    }
    throw error
  }

  const result = await providers.mobcash.withdrawFromAccount(betId, withdrawalCode)

  if (result.outcome === 'success') {
    const summa = String(result.data.Summa)
    if (!/^\d{1,14}(\.\d{1,4})?$/.test(summa) || !(Number(summa) > 0)) {
      // The code was consumed but we cannot read the amount: keep it Pending for staff, with the raw answer.
      const flagged = await transactionRepository.update(transaction.id, { metadata: { cashdesk: { outcome: 'unreadable', raw: result.data } } })
      return { transaction: flagged, outcome: 'pending-incomplete', replay: false }
    }
    const confirmed = await transactionRepository.update(transaction.id, { amount: summa, totalAmount: summa, paymentConfirmation: 'Successful' })
    afterPending(user, confirmed)
    return { transaction: confirmed, outcome: 'pending-incomplete', replay: false }
  }

  if (result.outcome === 'rejected') {
    const failed = await transactionRepository.settlePending(transaction.id, {
      status: V.TRANSACTION_STATUS.FAILED,
      paymentConfirmation: 'Failed',
      completedAt: new Date(),
      metadata: { cashdesk: { outcome: 'rejected', messageId: result.messageId || null } }
    })
    sendTemplate('WITHDRAWAL_FAILED', user.email, { fullname: user.fullname, amount: 0, betId })
    return { transaction: failed || transaction, outcome: 'failed', replay: false }
  }

  // unknown: the cashdesk may or may not have redeemed the code. Never auto-fail, never auto-retry.
  logger.warn({ transactionId: transaction.id }, 'cashdesk withdrawal outcome unknown: left Pending for staff')
  const flagged = await transactionRepository.update(transaction.id, { metadata: { cashdesk: { outcome: 'unknown', at: new Date().toISOString() } } })
  return { transaction: flagged, outcome: 'pending-incomplete', replay: false }
}

function afterPending (user, transaction) {
  sendTemplate('WITHDRAWAL_PENDING', user.email, { fullname: user.fullname, amount: transaction.totalAmount, betId: transaction.betId })
  notifyMoneyEvent(user.id, { title: 'Withdrawal', body: 'Your withdrawal request is being processed', data: { reference: transaction.reference } })
}

async function createWithdrawal (input) {
  await assertOpenAndUsable(input.user)
  const result = input.mode === 'wallet' ? await withdrawFromWallet(input) : await withdrawFromAccount(input)
  const user = await userRepository.findById(input.user.id)
  return { ...result, user }
}

module.exports = { createWithdrawal }
