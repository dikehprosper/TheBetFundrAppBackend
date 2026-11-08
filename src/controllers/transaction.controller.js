const depositService = require('../service/deposit.service')
const withdrawalService = require('../service/withdrawal.service')
const transferService = require('../service/transfer.service')
const { asyncHandler, AppError } = require('../utils/handlers')
const { parseAmount, parseDepositAmount } = require('../utils/helpers/money.helper')
const { sendMoneyResult, idempotencyKey, qosNetwork } = require('../utils/helpers/response.helper')

const walletClaim = (b) => (b.bonusBalance === undefined ? null : b.bonusBalance)

/** Deposit by mobile money (QOS), optionally topped up from the wallet. */
const deposit = asyncHandler(async (req, res) => {
  const b = req.body
  const result = await depositService.createDeposit({
    user: req.user, mode: 'qos', betId: b.betId, amount: parseDepositAmount(b.amount), momoNumber: b.momoNumber,
    network: qosNetwork(b.network), service: b.service, momoName: b.momoName || b.fullname || req.user.fullname,
    walletClaim: walletClaim(b), idempotencyKey: idempotencyKey(req)
  })
  await sendMoneyResult(res, result)
})

const depositWithFedapay = asyncHandler(async (req, res) => {
  const b = req.body
  const result = await depositService.createDeposit({
    user: req.user, mode: 'fedapay', betId: b.betId, amount: parseDepositAmount(b.amount), momoNumber: b.momoNumber,
    network: String(b.network).toLowerCase(), service: b.service, momoName: req.user.fullname,
    walletClaim: walletClaim(b), idempotencyKey: idempotencyKey(req)
  })
  await sendMoneyResult(res, result)
})

const walletDeposit = asyncHandler(async (req, res) => {
  const b = req.body
  const result = await depositService.createDeposit({
    user: req.user, mode: 'wallet', betId: b.betId, amount: parseDepositAmount(b.amount), service: b.service || 'wallet',
    idempotencyKey: idempotencyKey(req)
  })
  await sendMoneyResult(res, result)
})

const withdrawal = asyncHandler(async (req, res) => {
  const b = req.body
  const fromWallet = b.bonusBalance !== undefined && b.bonusBalance !== null && Number(b.bonusBalance) > 0
  let input
  if (fromWallet) {
    if (b.amount === undefined) throw new AppError(422, 'amount is required', { code: 422 })
    input = { mode: 'wallet', amount: parseAmount(b.amount) }
  } else {
    if (!b.betId || !b.withdrawalCode) throw new AppError(422, 'betId and withdrawalCode are required', { code: 422 })
    input = { mode: 'account', withdrawalCode: b.withdrawalCode }
  }
  const result = await withdrawalService.createWithdrawal({
    user: req.user, betId: b.betId || null, momoNumber: b.momoNumber, service: b.service, idempotencyKey: idempotencyKey(req), ...input
  })
  await sendMoneyResult(res, result)
})

/** Wallet to wallet. The sender is always the signed-in user. */
const walletSend = asyncHandler(async (req, res) => {
  const b = req.body
  const result = await transferService.sendMoney({
    sender: req.user, recipientId: b.recipientId || b.recipientid, amount: parseAmount(b.amount), idempotencyKey: idempotencyKey(req)
  })
  await sendMoneyResult(res, { ...result, outcome: 'completed' })
})

module.exports = { deposit, depositWithFedapay, walletDeposit, withdrawal, walletSend }
