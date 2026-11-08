const fs = require('node:fs')
const path = require('node:path')
const authService = require('../service/auth.service')
const userService = require('../service/user.service')
const qrService = require('../service/qr.service')
const { asyncHandler, AppError } = require('../utils/handlers')
const { parseDepositAmount } = require('../utils/helpers/money.helper')
const { loginPayload, toUserDto } = require('../utils/helpers/response.helper')
const { qrData } = require('./auth.controller')

const ok = (res, message, extra = {}, status = 200) => res.status(status).json({ success: true, message, status, ...extra })

const setPin = asyncHandler(async (req, res) => {
  const user = await authService.setPin(req.user, req.body.pin)
  const savedUser = await authService.userWithHistory(user)
  // Same session, so the token the app already holds keeps working. The new token only refreshes the pinState claim.
  res.status(201).json({ success: true, message: 'Pin set successfully', status: 201, token: authService.issueToken(user), savedUser })
})

const getUser = asyncHandler(async (req, res) => {
  const { user, token } = await authService.refreshSession(req.user, req.body.expoPushToken)
  await loginPayload(res, { user, token }, 'Succesfully')
})

const verifyUserPin = asyncHandler(async (req, res) => loginPayload(res, await authService.verifyPin(req.user, req.body.pin), 'Logged in succesfully'))

const getUpdatedData = asyncHandler(async (req, res) => {
  const savedUser = await authService.userWithHistory(req.user)
  ok(res, 'Succesfully', { savedUser, user: savedUser }, 201)
})

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user, req.body.password, req.body.newPassword)
  ok(res, 'Password changed successfully', {}, 201)
})

const requestPin = asyncHandler(async (req, res) => {
  await authService.requestPinReset(req.user)
  ok(res, 'successful', {}, 201)
})

const checkPin = asyncHandler(async (req, res) => {
  await authService.checkPinResetCode(req.user, req.body.pin)
  ok(res, 'Code verified', {}, 201)
})

const changeUserPin = asyncHandler(async (req, res) => {
  await authService.changePin(req.user, req.body.pin, req.body.code)
  ok(res, 'Pin changed successfully', {}, 201)
})

const changeColorScheme = asyncHandler(async (req, res) => {
  const user = await userService.changeColorScheme(req.user, req.body.colorScheme)
  ok(res, 'Color scheme updated', { colorScheme: user.colorScheme }, 201)
})

const setTag = asyncHandler(async (req, res) => {
  const user = await userService.setTag(req.user, req.body.tag)
  ok(res, 'Tag set successfully', { tag: user.tag }, 201)
})

const getTotalReferral = asyncHandler(async (req, res) => {
  const referrals = await userService.referrals(req.user)
  ok(res, 'Successful', { referrals, totalReferrals: referrals.length }, 201)
})

const editProfileImage = asyncHandler(async (req, res) => {
  const user = await userService.changeProfileImage(req.user, req.file)
  ok(res, 'Profile image updated', { image: user.image, savedUser: toUserDto(user) }, 201)
})

const changeUserDetails = asyncHandler(async (req, res) => {
  const user = await userService.changeDetails(req.user, req.body)
  ok(res, 'Details updated', { savedUser: toUserDto(user) }, 201)
})

const getSocials = (_req, res) => res.status(200).json({
  success: 201,
  status: 201,
  data: {
    whatsapp: process.env.SUPPORT_WHATSAPP || '',
    email: process.env.SUPPORT_EMAIL || '',
    twitter: process.env.SUPPORT_TWITTER || '',
    phone: process.env.SUPPORT_PHONE || ''
  }
})

const privacyPolicies = (_req, res) => {
  const dir = path.join(__dirname, '..', 'utils', 'saved_policies')
  res.status(200).json({
    english: fs.readFileSync(path.join(dir, 'privacy_policy_en.txt'), 'utf8'),
    french: fs.readFileSync(path.join(dir, 'privacy_policy_fr.txt'), 'utf8')
  })
}

const submitDeleteAccountForm = asyncHandler(async (req, res) => {
  await userService.requestAccountDeletion(req.user, req.body.password)
  ok(res, 'Your request has been received', {}, 201)
})

const searchSendingPage = asyncHandler(async (req, res) => {
  const users = await userService.searchUsers(req.user, req.body.query)
  ok(res, 'Successful', { users, data: users }, 201)
})

const generateQRCode = asyncHandler(async (req, res) => {
  const amount = parseDepositAmount(req.body.amount)
  const qr = await qrService.generate({ user: req.user, betId: req.body.betId, amount, service: req.body.service })
  ok(res, 'QR code generated', { qrCode: qrData(qr), qrId: qr.id }, 201)
})

module.exports = {
  setPin, getUser, verifyUserPin, getUpdatedData, changePassword, requestPin, checkPin, changeUserPin, changeColorScheme,
  setTag, getTotalReferral, editProfileImage, changeUserDetails, getSocials, privacyPolicies, submitDeleteAccountForm,
  searchSendingPage, generateQRCode, AppError
}
