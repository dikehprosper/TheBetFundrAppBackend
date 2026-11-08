const { toUserDto, toLegacyTransaction } = require('./dto.helper')
const authService = require('../../service/auth.service')
const { AppError } = require('../handlers')
const { NETWORKS } = require('../variables.helper')

const MESSAGES = {
  completed: 'Transaction fully completed',
  incomplete: 'Transaction wasnt fully completed',
  pending: 'Transaction is being processed',
  failed: 'Transaction failed',
  'pending-complete': 'Transaction fully completed',
  'pending-incomplete': 'Transaction wasnt fully completed'
}

/** Money endpoints answer in the shape the app already reads: success, message, userTransaction, user. */
async function sendMoneyResult (res, { transaction, user, outcome, replay }, status = 200) {
  const dto = await authService.userWithHistory(user)
  return res.status(status).json({
    success: true,
    message: MESSAGES[outcome] || MESSAGES.pending,
    status,
    replay: !!replay,
    userTransaction: toLegacyTransaction(transaction),
    user: dto
  })
}

/** Idempotency-Key header (preferred) or body field. Lets a client safely retry a payment request. */
function idempotencyKey (req) {
  const key = req.headers['idempotency-key'] || (req.body && req.body.idempotencyKey)
  if (key === undefined || key === null || key === '') return null
  if (!/^[A-Za-z0-9_\-:.]{6,100}$/.test(String(key))) throw new AppError(422, 'Idempotency-Key must be 6-100 characters: letters, digits and _ - : .', { code: 422 })
  return String(key)
}

function qosNetwork (value) {
  const upper = String(value).toUpperCase()
  if (!Object.values(NETWORKS).includes(upper)) throw new AppError(422, 'network must be MTN or MOOV', { code: 422 })
  return upper
}

const loginPayload = async (res, { user, token }, message) => {
  const savedUser = await authService.userWithHistory(user)
  return res.header('auth-token', token).status(200).json({ success: true, message, token, status: 201, savedUser, user: savedUser })
}

module.exports = { sendMoneyResult, idempotencyKey, qosNetwork, loginPayload, toUserDto }
