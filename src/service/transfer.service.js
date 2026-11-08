const { userRepository, transactionRepository } = require('../repositories')
const wallet = require('./wallet.service')
const { notifyMoneyEvent } = require('./notification.service')
const { sendTemplate } = require('../utils/helpers/mail.helper')
const { generateReference } = require('../utils/helpers/ids.helper')
const { AppError } = require('../utils/handlers')
const V = require('../utils/variables.helper')

/**
 * Wallet-to-wallet transfer.
 *
 * The sender is ALWAYS the authenticated user (the old API took the sender id from the request
 * body, so anyone could spend anyone's wallet). Both wallets change, both history rows are
 * written and the two ledger entries are appended inside ONE database transaction.
 * Rows are locked in id order, so opposite transfers (A to B and B to A) cannot deadlock.
 */
const UNIQUE_VIOLATION = '23505'

async function sendMoney ({ sender, recipientId, amount, idempotencyKey }) {
  if (!sender || !sender.isActivated) throw new AppError(502, 'User is deactivated')
  if (sender.id === recipientId) throw new AppError(400, 'You cannot send money to yourself')

  try {
    const outcome = await wallet.runInTransaction(async (t) => {
      if (idempotencyKey) {
        const existing = await transactionRepository.findByIdempotencyKey(sender.id, idempotencyKey, { transaction: t })
        if (existing) return { transaction: existing, replay: true }
      }

      await userRepository.lockUsers([sender.id, recipientId], t)
      const recipient = await userRepository.findById(recipientId, { transaction: t })
      if (!recipient) throw new AppError(404, 'Recipient not found')
      if (!recipient.isActivated) throw new AppError(502, 'Recipient account is deactivated')
      const freshSender = await userRepository.findById(sender.id, { transaction: t })
      if (!freshSender || !freshSender.isActivated) throw new AppError(502, 'User is deactivated')

      const reference = generateReference()
      const common = {
        reference,
        status: V.TRANSACTION_STATUS.SUCCESSFUL,
        paymentConfirmation: 'Successful',
        amount,
        totalAmount: amount,
        walletAmount: amount,
        completedAt: new Date(),
        senderName: freshSender.fullname,
        recipientName: recipient.fullname,
        recipientTag: recipient.tag
      }
      const sent = await transactionRepository.create({
        ...common, fundingType: V.FUNDING_TYPE.SEND, userId: freshSender.id, counterpartyId: recipient.id,
        userEmail: freshSender.email, idempotencyKey: idempotencyKey || null
      }, { transaction: t })
      const received = await transactionRepository.create({
        ...common, fundingType: V.FUNDING_TYPE.RECEIVE, userId: recipient.id, counterpartyId: freshSender.id, userEmail: recipient.email
      }, { transaction: t })

      await wallet.debit(freshSender.id, amount, V.LEDGER.TRANSFER_OUT, sent.id, t)
      await wallet.credit(recipient.id, amount, V.LEDGER.TRANSFER_IN, received.id, t)
      return { transaction: sent, received, sender: freshSender, recipient, replay: false }
    })

    if (!outcome.replay) {
      sendTemplate('TRANSFER_SENT', outcome.sender.email, { fullname: outcome.sender.fullname, amount, recipientName: outcome.recipient.fullname })
      sendTemplate('TRANSFER_RECEIVED', outcome.recipient.email, { fullname: outcome.recipient.fullname, amount, senderName: outcome.sender.fullname })
      notifyMoneyEvent(outcome.recipient.id, { title: 'Money received', body: `${outcome.sender.fullname} sent you ${Number(amount)}`, data: { reference: outcome.transaction.reference } })
    }
    const user = await userRepository.findById(sender.id)
    return { transaction: outcome.transaction, user, replay: outcome.replay }
  } catch (error) {
    if (error && error.parent && error.parent.code === UNIQUE_VIOLATION && idempotencyKey) {
      const existing = await transactionRepository.findByIdempotencyKey(sender.id, idempotencyKey)
      if (existing) return { transaction: existing, user: await userRepository.findById(sender.id), replay: true }
    }
    throw error
  }
}

module.exports = { sendMoney }
