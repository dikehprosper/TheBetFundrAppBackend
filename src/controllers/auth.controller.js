const passport = require('../config/passport.config')
const authService = require('../service/auth.service')
const depositService = require('../service/deposit.service')
const qrService = require('../service/qr.service')
const { qrRepository, userRepository } = require('../repositories')
const { sequelize } = require('../models')
const { asyncHandler, AppError } = require('../utils/handlers')
const { parseDepositAmount } = require('../utils/helpers/money.helper')
const { sendMoneyResult, idempotencyKey, qosNetwork, loginPayload } = require('../utils/helpers/response.helper')
const crypto = require('node:crypto')

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(req.body)
  const savedUser = await authService.userWithHistory(user)
  res.header('auth-token', token).status(200).json({ message: 'Registered successfully', token, success: true, savedUser })
})

const login = (req, res, next) => {
  passport.authenticate('local', { session: false }, async (error, user, info) => {
    try {
      if (error) return next(error)
      if (!user) return next(new AppError(info.code, info.message))
      return await loginPayload(res, await authService.login(user), 'Logged in succesfully')
    } catch (err) {
      return next(err)
    }
  })(req, res, next)
}

const resetPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email)
  res.status(200).json({ success: true, message: 'successful', status: 201 })
})

const checkPin2 = asyncHandler(async (req, res) => {
  await authService.checkPasswordResetCode(req.body.email, req.body.pin)
  res.status(200).json({ success: true, message: 'Code verified', status: 201 })
})

const resetPasswordWithCode = asyncHandler(async (req, res) => {
  await authService.resetPasswordWithCode(req.body.email, req.body.pin, req.body.password)
  res.status(200).json({ success: true, message: 'Password reset successfully', status: 201 })
})

// ------------------------------------------------------------------ QR codes
const qrData = (qr) => ({ _id: qr.id, id: qr.id, betId: qr.betId, amount: Number(qr.amount), service: qr.service, fullname: qr.fullname, validUntil: qr.validUntil, qrcodeStatus: qr.qrcodeStatus })

const checkQRCodeValidity = asyncHandler(async (req, res) => {
  const qr = await qrService.checkValidity(req.body.qrId)
  if (qr.qrcodeStatus === 'Expired') throw new AppError(400, 'QR code has expired')
  if (qr.used) throw new AppError(400, 'QR code has already been used')
  res.status(200).json({ success: true, message: 'QR code is still valid', status: 200, qrCodeData: qrData(qr) })
})

const getQRCode = asyncHandler(async (_req, res) => {
  const ids = await qrService.listOpenIds()
  if (!ids.length) return res.status(404).json({ success: false, message: 'No QR codes found', status: 404 })
  return res.status(200).json({ success: true, message: 'QR codes retrieved successfully', status: 200, qrCodes: ids })
})

/** Pay a QR code without logging in. The QR owner's account is credited. */
const noLoginDeposit = asyncHandler(async (req, res) => {
  const { qrId, momoNumber, service } = req.body
  const qr = await qrService.checkValidity(qrId)
  if (qr.qrcodeStatus === 'Expired') throw new AppError(400, 'QR code has expired')
  const claimed = await sequelize.transaction((t) => qrRepository.claim(qr.id, t))
  if (!claimed) throw new AppError(400, 'QR code has already been used')

  try {
    const owner = await userRepository.findById(qr.userId)
    const result = await depositService.createDeposit({
      user: owner, mode: 'qos', qr, betId: qr.betId, amount: parseDepositAmount(String(qr.amount).replace(/\.0+$/, '')),
      momoNumber, network: qosNetwork(req.body.network), service: service || qr.service,
      momoName: req.body.momoName || req.body.fullname || 'Customer', idempotencyKey: idempotencyKey(req), authenticated: false
    })
    await sendMoneyResult(res, result)
  } catch (error) {
    // nothing was taken: give the QR code back so it can be tried again
    await qrRepository.release(qr.id)
    throw error
  }
})

/** Deposit without logging in, identified by email. Mobile money only (no wallet use). */
const publicDeposit = asyncHandler(async (req, res) => {
  const b = req.body
  const user = await userRepository.findByEmail(b.email)
  if (!user) throw new AppError(501, 'User does not exists')
  const result = await depositService.createDeposit({
    user, mode: 'qos', betId: b.betId, amount: parseDepositAmount(b.amount), momoNumber: b.momoNumber, network: qosNetwork(b.network),
    service: b.service, momoName: b.momoName || b.fullname || user.fullname, idempotencyKey: idempotencyKey(req), authenticated: false
  })
  await sendMoneyResult(res, result)
})

/**
 * Payment provider callback. Protected by a shared secret and NEVER trusted for the outcome:
 * it only makes us re-check the status with the provider.
 */
const qosCallback = asyncHandler(async (req, res) => {
  const expected = process.env.QOS_WEBHOOK_SECRET
  if (!expected) throw new AppError(503, 'Callback endpoint is not configured')
  const supplied = String(req.query.secret || req.headers['x-webhook-secret'] || '')
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new AppError(403, 'Forbidden')
  const reference = req.body.transref || req.body.reference
  await depositService.handleQosCallback(reference, req.body.status || req.body.responsemsg || null, req.body)
  res.status(200).json({ received: true })
})

const requestAddress = (_req, res) => res.status(200).json({
  address: {
    street: process.env.PUBLIC_STREET || 'Lagos',
    city: process.env.PUBLIC_CITY || 'Lamedcash',
    marqueTextEng: 'WELCOME AND THANKS FOR USING OUR SERVICE',
    marqueTextFRC: "BIENVENUE ET MERCI D'UTILISER NOTRE SERVICE"
  }
})

module.exports = { register, login, resetPassword, checkPin2, resetPasswordWithCode, checkQRCodeValidity, getQRCode, noLoginDeposit, publicDeposit, qosCallback, requestAddress, qrData }
