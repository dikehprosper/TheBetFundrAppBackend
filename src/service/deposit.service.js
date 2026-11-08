const { sequelize, Transaction } = require('../models')
const { userRepository, transactionRepository, settingsRepository, qrRepository } = require('../repositories')
const wallet = require('./wallet.service')
const providers = require('./providers')
const { notifyMoneyEvent } = require('./notification.service')
const { sendTemplate } = require('../utils/helpers/mail.helper')
const { generateReference } = require('../utils/helpers/ids.helper')
const { providerChargeAmount } = require('../utils/helpers/money.helper')
const { AppError } = require('../utils/handlers')
const logger = require('../config/logger.config')
const V = require('../utils/variables.helper')

/**
 * DEPOSIT = take money from the customer (wallet and/or mobile money) and credit their betting account.
 *
 * Integrity rules that hold on every path:
 *  - The wallet portion is DEBITED INSIDE the same database transaction that creates the
 *    Pending transaction (a "hold"). No provider call ever happens while a database transaction
 *    is open, and no provider call happens before the money is held.
 *  - A hold is refunded only when the payment provider DEFINITELY failed.
 *    When the outcome is unknown (timeout) the transaction stays Pending, funds stay held.
 *  - The cashdesk is credited at most once per transaction (provider-confirmation claim below).
 *  - Settlement (Pending -> Successful / Failed) uses a guarded UPDATE, so retries, webhooks and
 *    pollers cannot settle or pay a referral bonus twice.
 */

const UNIQUE_VIOLATION = '23505'
const isUnique = (error) => error && error.parent && error.parent.code === UNIQUE_VIOLATION

/** The 5 minute duplicate rule the cashdesk enforces, checked up front so nobody is charged for a credit that would bounce. */
async function assertNoRecentDuplicate (betId, amount, t) {
  const since = new Date(Date.now() - V.DUPLICATE_DEPOSIT_WINDOW_MS)
  const duplicate = await transactionRepository.findRecentSuccessfulDeposit(betId, amount, since, { transaction: t })
  if (duplicate) {
    throw new AppError(409, `A payment of ${Number(amount)} has already been made to this account. It can be made again in 5 minutes.`, { code: V.CODES.DUPLICATE_DEPOSIT })
  }
}

async function assertDepositsOpen () {
  const settings = await settingsRepository.get()
  if (settings.isDepositsOpen === false) throw new AppError(504, 'currently under maintainance')
}

function assertUsable (user) {
  if (!user) throw new AppError(401, 'User not found')
  if (!user.isActivated) throw new AppError(502, 'User is deactivated')
}

/**
 * Step 1. In ONE database transaction: replay check, wallet hold, Pending transaction row.
 * Returns { transaction, replay }.
 */
async function openDeposit (ctx) {
  const { user, betId, amount, mode, walletClaim, idempotencyKey, qr, momoNumber, momoName, network, service, provider } = ctx
  try {
    return await wallet.runInTransaction(async (t) => {
      if (idempotencyKey) {
        const existing = await transactionRepository.findByIdempotencyKey(user.id, idempotencyKey, { transaction: t })
        if (existing) return { transaction: existing, replay: true }
      }
      await userRepository.lockUsers([user.id], t)
      await assertNoRecentDuplicate(betId, amount, t)

      let walletPart = '0.0000'
      let cashPart = amount
      if (mode === 'wallet' || walletClaim !== null) {
        const split = await wallet.splitAgainstBalance(user.id, amount, t)
        const claimedFull = mode === 'wallet' || Number(walletClaim) >= Number(amount)
        // Wallet-only deposits (and "my wallet covers it" claims) need the REAL balance to cover it.
        if (claimedFull && Number(split.cashPart) > 0) throw new AppError(506, 'wallet balance not sufficient', { code: V.CODES.INSUFFICIENT_FUNDS })
        walletPart = split.walletPart
        cashPart = split.cashPart
      }

      const reference = generateReference()
      const walletOnly = Number(cashPart) === 0
      const transaction = await transactionRepository.create({
        reference,
        fundingType: V.FUNDING_TYPE.DEPOSITS,
        status: V.TRANSACTION_STATUS.PENDING,
        paymentConfirmation: walletOnly ? 'Successful' : 'Pending',
        userId: user.id,
        amount: cashPart,
        totalAmount: amount,
        walletAmount: walletPart,
        betId,
        momoNumber: walletOnly ? null : momoNumber,
        momoName: walletOnly ? null : momoName,
        network: walletOnly ? null : network,
        service,
        authenticatedDeposit: !qr && ctx.authenticated !== false,
        qrCodeId: qr ? qr.id : null,
        provider: walletOnly ? 'wallet' : provider,
        idempotencyKey: idempotencyKey || null,
        userEmail: user.email
      }, { transaction: t })

      if (Number(walletPart) > 0) await wallet.debit(user.id, walletPart, V.LEDGER.DEPOSIT_HOLD, transaction.id, t)
      return { transaction, replay: false }
    })
  } catch (error) {
    if (isUnique(error) && idempotencyKey) {
      // two identical requests raced: the loser replays the winner
      const existing = await transactionRepository.findByIdempotencyKey(user.id, idempotencyKey)
      if (existing) return { transaction: existing, replay: true }
    }
    throw error
  }
}

/** Provider definitely failed: mark Failed and give the wallet hold back, once. */
async function failDeposit (transaction, qr, reason) {
  return wallet.runInTransaction(async (t) => {
    const settled = await transactionRepository.settlePending(transaction.id, {
      status: V.TRANSACTION_STATUS.FAILED,
      paymentConfirmation: 'Failed',
      completedAt: new Date(),
      metadata: { ...transaction.metadata, failureReason: reason }
    }, { transaction: t })
    if (settled && Number(transaction.walletAmount) > 0) {
      await wallet.credit(transaction.userId, String(transaction.walletAmount), V.LEDGER.DEPOSIT_REFUND, transaction.id, t)
    }
    if (settled && qr) await qrRepository.setConfirmation(qr.id, 'Failed', t)
    if (settled && qr) await qrRepository.release(qr.id, t)
    return settled || (await transactionRepository.findById(transaction.id, { transaction: t }))
  })
}

/**
 * Step 3. Credit the betting account and settle. Safe to call from the request, a webhook or a
 * reconciliation job: only the caller that flips payment_confirmation Pending -> Successful
 * (or the creator of a wallet-only deposit) may call the cashdesk.
 */
async function finalizeDeposit (transactionId, { alreadyOwned = false } = {}) {
  let transaction = await transactionRepository.findById(transactionId)
  if (!transaction) throw new AppError(404, 'Transaction not found')
  if (transaction.status !== V.TRANSACTION_STATUS.PENDING) return { transaction, outcome: transaction.status === 'Successful' ? 'completed' : 'failed' }

  if (!alreadyOwned) {
    const [rows] = await sequelize.query(
      "UPDATE transactions SET payment_confirmation = 'Successful', updated_at = now() WHERE id = :id AND status = 'Pending' AND payment_confirmation = 'Pending' RETURNING id",
      { replacements: { id: transactionId } }
    )
    if (rows.length === 0) {
      // somebody else owns settlement (or the cashdesk step already ran)
      transaction = await transactionRepository.findById(transactionId)
      return { transaction, outcome: transaction.status === 'Successful' ? 'completed' : 'incomplete' }
    }
  }

  const result = await providers.mobcash.rechargeAccount(transaction.betId, String(transaction.totalAmount))

  if (result.outcome === 'success') {
    const done = await completeDeposit(transaction)
    return { transaction: done, outcome: 'completed' }
  }

  // The money is already taken. Keep the transaction Pending, flag why, never refund on a guess.
  const customErrorCode =
    result.outcome === 'rejected' && result.messageId === V.CASHDESK.ALREADY_PAID ? V.CODES.DUPLICATE_DEPOSIT
      : result.outcome === 'rejected' && result.messageId === V.CASHDESK.CURRENCY_MISMATCH ? V.CODES.CURRENCY_MISMATCH
        : null
  logger.warn({ transactionId, outcome: result.outcome, messageId: result.messageId }, 'cashdesk did not confirm deposit')
  const flagged = await transactionRepository.update(transactionId, {
    customErrorCode,
    metadata: { ...transaction.metadata, cashdesk: { outcome: result.outcome, messageId: result.messageId || null, at: new Date().toISOString() } }
  })
  notifyAfterDeposit(flagged, 'pending')
  return { transaction: flagged, outcome: 'incomplete' }
}

/** Atomically: settle Successful, count it, and pay the referral bonus. All or nothing. */
async function completeDeposit (transaction) {
  const settled = await wallet.runInTransaction(async (t) => {
    const done = await transactionRepository.settlePending(transaction.id, {
      status: V.TRANSACTION_STATUS.SUCCESSFUL,
      paymentConfirmation: 'Successful',
      completedAt: new Date()
    }, { transaction: t })
    if (!done) return null // already settled elsewhere: no second counter bump, no second bonus

    await sequelize.query('UPDATE users SET successful_deposit_count = successful_deposit_count + 1, updated_at = now() WHERE id = :id', {
      replacements: { id: transaction.userId }, transaction: t
    })

    const depositor = await userRepository.findById(transaction.userId, { transaction: t })
    if (depositor && depositor.referrerId) {
      const referrer = await userRepository.findById(depositor.referrerId, { transaction: t })
      if (referrer) {
        const bonus = await wallet.referralBonusFor(String(transaction.totalAmount), V.REFERRAL_BONUS_RATE, t)
        if (Number(bonus) > 0) {
          const bonusTx = await transactionRepository.create({
            reference: generateReference(),
            fundingType: V.FUNDING_TYPE.BONUS,
            status: V.TRANSACTION_STATUS.SUCCESSFUL,
            paymentConfirmation: 'Successful',
            userId: referrer.id,
            counterpartyId: depositor.id,
            amount: bonus,
            totalAmount: bonus,
            walletAmount: bonus,
            userEmail: referrer.email,
            senderName: depositor.fullname,
            completedAt: new Date(),
            metadata: { sourceTransactionId: transaction.id }
          }, { transaction: t })
          await wallet.credit(referrer.id, bonus, V.LEDGER.REFERRAL_BONUS, bonusTx.id, t)
          await settingsRepository.addDisbursedBonus(bonus, t)
          done.referralBonus = { referrerId: referrer.id, amount: bonus }
        }
      }
    }
    return done
  })

  if (!settled) return transactionRepository.findById(transaction.id)
  notifyAfterDeposit(settled, 'completed')
  if (settled.referralBonus) notifyReferrer(settled.referralBonus)
  return settled
}

function notifyAfterDeposit (transaction, outcome) {
  const data = { fullname: null, amount: transaction.totalAmount, betId: transaction.betId }
  userRepository.findById(transaction.userId).then((user) => {
    if (!user) return
    data.fullname = user.fullname
    const type = outcome === 'completed' ? 'DEPOSIT_SUCCESSFUL' : outcome === 'failed' ? 'DEPOSIT_FAILED' : 'DEPOSIT_PENDING'
    sendTemplate(type, transaction.userEmail || user.email, data)
    notifyMoneyEvent(user.id, { title: 'Deposit', body: `Your deposit is ${outcome}`, data: { reference: transaction.reference, status: transaction.status } })
  }).catch(() => {})
}

function notifyReferrer ({ referrerId, amount }) {
  userRepository.findById(referrerId).then((referrer) => {
    if (!referrer) return
    sendTemplate('REFERRAL_BONUS', referrer.email, { fullname: referrer.fullname, amount })
    notifyMoneyEvent(referrer.id, { title: 'Referral bonus', body: 'You earned a referral bonus', data: { amount } })
  }).catch(() => {})
}

/** Shape every deposit entry point returns. */
async function buildResult (transaction, outcome, replay) {
  const user = await userRepository.findById(transaction.userId)
  return { transaction, user, outcome, replay: !!replay }
}

/**
 * Create a deposit.
 *   mode 'qos'     - customer pays by MTN / MOOV mobile money (QOS), optionally topped up from the wallet
 *   mode 'fedapay' - customer pays through Fedapay (left Pending: see README, open issues)
 *   mode 'wallet'  - paid entirely from the wallet
 * `qr` is set for QR deposits made without logging in; `authenticated:false` for the email-only flow.
 */
async function createDeposit (input) {
  const { user, mode } = input
  assertUsable(user)
  await assertDepositsOpen()

  const ctx = { ...input, walletClaim: input.walletClaim === undefined ? null : input.walletClaim, provider: mode === 'fedapay' ? 'fedapay' : 'qos' }
  if (mode === 'wallet' && ctx.walletClaim === null) ctx.walletClaim = ctx.amount

  const { transaction, replay } = await openDeposit(ctx)
  if (replay) return buildResult(transaction, transaction.status === 'Successful' ? 'completed' : transaction.status === 'Failed' ? 'failed' : 'pending', true)

  const walletOnly = Number(transaction.amount) === 0
  if (walletOnly) {
    const { transaction: finished, outcome } = await finalizeDeposit(transaction.id, { alreadyOwned: true })
    return buildResult(finished, outcome, false)
  }

  if (mode === 'fedapay') return runFedapay(ctx, transaction)
  return runQos(ctx, transaction)
}

async function runQos (ctx, transaction) {
  const { user, qr } = ctx
  let collected
  try {
    collected = await providers.qos.collect({
      amount: String(transaction.amount),
      momoNumber: ctx.momoNumber,
      network: ctx.network,
      fullname: ctx.momoName || user.fullname,
      reference: transaction.reference
    })
  } catch (error) {
    logger.error({ err: error, transactionId: transaction.id }, 'QOS collect threw: outcome unknown, keeping Pending')
    collected = { status: 'PENDING' }
  }

  if (collected.status === 'FAILED') {
    const failed = await failDeposit(transaction, qr, 'payment provider reported failure')
    notifyAfterDeposit(failed, 'failed')
    return buildResult(failed, 'failed', false)
  }
  if (collected.status === 'PENDING') {
    return buildResult(await transactionRepository.findById(transaction.id), 'pending', false)
  }
  const { transaction: finished, outcome } = await finalizeDeposit(transaction.id)
  return buildResult(finished, outcome, false)
}

async function runFedapay (ctx, transaction) {
  const { user } = ctx
  try {
    const customerId = await providers.fedapay.ensureCustomer({
      fedapayId: user.fedapayId, email: user.email, fullname: user.fullname, phoneNumber: user.phoneNumber
    })
    if (!user.fedapayId) await userRepository.updateById(user.id, { fedapayId: customerId })
    const { providerTransactionId } = await providers.fedapay.initiateCollection({
      chargeAmount: providerChargeAmount(transaction.amount, V.FEDAPAY_PROVIDER_FEE_PERCENT),
      email: user.email,
      momoNumber: ctx.momoNumber,
      registeredNumber: user.phoneNumber,
      customerId,
      network: ctx.network
    })
    const pending = await transactionRepository.update(transaction.id, { providerTransactionId })
    return buildResult(pending, 'pending', false)
  } catch (error) {
    if (error && error.rejected) {
      const failed = await failDeposit(transaction, null, 'fedapay refused the payment request')
      throw new AppError(505, 'Payment request was not accepted. Please try again.', { details: { transaction: failed.reference } })
    }
    logger.error({ err: error, transactionId: transaction.id }, 'Fedapay error: outcome unknown, keeping Pending')
    return buildResult(await transactionRepository.findById(transaction.id), 'pending', false)
  }
}

/**
 * Provider callback hint (QOS). The body is never trusted: it only triggers a re-check with the
 * provider, and settlement then follows the same guarded path as a normal deposit.
 */
async function handleQosCallback (reference, reportedStatus, raw) {
  const { PaymentEvent } = require('../models')
  await PaymentEvent.create({ provider: 'qos', reference, reportedStatus, raw })
  const transaction = await transactionRepository.findByReference(reference, V.FUNDING_TYPE.DEPOSITS)
  if (!transaction || transaction.status !== 'Pending' || transaction.provider !== 'qos') return { handled: false }
  const status = await providers.qos.checkStatus(reference, transaction.network)
  if (status === 'FAILED') {
    const qr = transaction.qrCodeId ? await qrRepository.findById(transaction.qrCodeId) : null
    const failed = await failDeposit(transaction, qr, 'payment provider reported failure')
    notifyAfterDeposit(failed, 'failed')
    return { handled: true, status: 'Failed' }
  }
  if (status === 'SUCCESSFUL') {
    const { transaction: finished } = await finalizeDeposit(transaction.id)
    return { handled: true, status: finished.status }
  }
  return { handled: true, status: 'Pending' }
}

module.exports = { createDeposit, finalizeDeposit, handleQosCallback, Transaction }
