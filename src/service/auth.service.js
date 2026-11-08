const crypto = require('node:crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { sequelize, User } = require('../models')
const { userRepository, transactionRepository } = require('../repositories')
const { AppError } = require('../utils/handlers')
const { generateCode, sha256 } = require('../utils/helpers/ids.helper')
const { sendTemplate } = require('../utils/helpers/mail.helper')
const { toUserDto } = require('../utils/helpers/dto.helper')

const BCRYPT_ROUNDS = 10
const RESET_CODE_TTL_MS = 15 * 60 * 1000
const MAX_RESET_ATTEMPTS = 5
const HISTORY_LIMIT = 200

const tokenKey = () => process.env.ACCESS_TOKEN_PRIVATE_KEY
const tokenAlgorithm = () => process.env.ACCESS_TOKEN_ALGORITHM || 'HS256'

/** The JWT carries both the new claim names and the old ones (_id, isAdmin ...) the app may still read. */
function issueToken (user) {
  return jwt.sign({
    id: user.id,
    _id: user.id,
    email: user.email,
    fullname: user.fullname,
    role: user.role,
    isAdmin: user.role === 'admin',
    isUser: user.role === 'user',
    isSubAdminDeposits: user.isSubAdminDeposits,
    isSubAdminWithdrawals: user.isSubAdminWithdrawals,
    sessionId: user.sessionId,
    pinState: user.pinState
  }, tokenKey(), { algorithm: tokenAlgorithm(), expiresIn: process.env.ACCESS_TOKEN_EXPIRATION || '30d' })
}

/** A new session replaces the previous one: the older token stops working (single-device sign-in). */
async function startSession (user) {
  return userRepository.updateById(user.id, { sessionId: crypto.randomUUID(), isLoggedIn: true })
}

async function userWithHistory (user) {
  const rows = await transactionRepository.listByUser(user.id, { limit: HISTORY_LIMIT })
  return toUserDto(user, { transactions: rows.reverse() })
}

const hashSecret = (value) => bcrypt.hash(String(value), BCRYPT_ROUNDS)

async function generateTag (fullname) {
  const first = String(fullname).trim().split(/\s+/)[0].replace(/\d/g, '').replace(/[^a-zA-Z_-]/g, '')
  const base = `lamedcash-${first || 'user'}`
  const start = (await userRepository.countByTagPrefix(base)) + 1
  for (let i = 0; i < 8; i += 1) {
    const candidate = `${base}${start + i}`
    if (!(await userRepository.findByTag(candidate))) return candidate
  }
  return `${base}${crypto.randomInt(10000, 99999)}`
}

async function register ({ fullname, betId, number, email, password, referrerId: referrerTag }) {
  if (await userRepository.findByEmail(email)) throw new AppError(400, 'User already exists')

  let referrer = null
  if (referrerTag) {
    referrer = await userRepository.findByTag(referrerTag)
    // the app reads this as a body code on an HTTP 200, as before
    if (!referrer) throw new AppError(200, 'Referer does not exist', { code: 503 })
  }

  const passwordHash = await hashSecret(password)
  let user
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      user = await userRepository.create({
        fullname, email: email.trim().toLowerCase(), passwordHash, betId: betId || null, phoneNumber: number ? String(number) : null,
        tag: await generateTag(fullname), referrerId: referrer ? referrer.id : null,
        sessionId: crypto.randomUUID(), isLoggedIn: true
      })
      break
    } catch (error) {
      const constraint = error && error.parent && error.parent.constraint
      if (error.name === 'SequelizeUniqueConstraintError' && /tag/.test(String(constraint))) continue
      if (error.name === 'SequelizeUniqueConstraintError') throw new AppError(400, 'User already exists')
      throw error
    }
  }
  if (!user) throw new AppError(500, 'Could not create the account. Please try again.')
  return { user, token: issueToken(user) }
}

/** `user` has already passed the credential check (passport-local). */
async function login (user) {
  const isAdmin = user.role === 'admin'
  if (!user.pinState && !isAdmin) throw new AppError(504, 'Pin not set', { extra: { email: user.email } })
  const session = await startSession(user)
  return { user: session, token: issueToken(session) }
}

async function verifyPin (user, pin) {
  if (!user.pinHash || !(await bcrypt.compare(String(pin), user.pinHash))) throw new AppError(503, 'Invalid pin')
  const session = await startSession(user)
  return { user: session, token: issueToken(session) }
}

/** App start: attach the device's push token and rotate the session. */
async function refreshSession (user, expoPushToken) {
  const changes = { sessionId: crypto.randomUUID(), isLoggedIn: true }
  if (expoPushToken) changes.expoPushToken = String(expoPushToken)
  const session = await userRepository.updateById(user.id, changes)
  return { user: session, token: issueToken(session) }
}

async function setPin (user, pin) {
  if (user.pinState) throw new AppError(400, 'A PIN is already set. Use the PIN reset flow to change it.')
  return userRepository.updateById(user.id, { pinHash: await hashSecret(pin), pinState: true })
}

// ------------------------------------------------------------- one-time codes
const codeHash = (purpose, userId, code) => sha256(`${purpose}:${userId}:${code}`)

async function issueCode (user, purpose) {
  const code = generateCode()
  await userRepository.updateById(user.id, {
    resetCodeHash: codeHash(purpose, user.id, code),
    resetCodeExpiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    resetCodeAttempts: 0
  })
  await sendTemplate(purpose === 'pin' ? 'PIN_RESET_CODE' : 'PASSWORD_RESET_CODE', user.email, { fullname: user.fullname, code })
  return code
}

/** Constant-time check. A wrong guess counts toward the lockout. Returns on success, throws otherwise. */
async function checkCode (user, purpose, code, { consume = false } = {}) {
  const fresh = await userRepository.findById(user.id)
  if (!fresh.resetCodeHash || !fresh.resetCodeExpiresAt || fresh.resetCodeExpiresAt.getTime() < Date.now()) {
    throw new AppError(400, 'This code has expired. Please request a new one.')
  }
  if (fresh.resetCodeAttempts >= MAX_RESET_ATTEMPTS) {
    throw new AppError(429, 'Too many wrong attempts. Please request a new code.')
  }
  const supplied = Buffer.from(codeHash(purpose, fresh.id, String(code)))
  const stored = Buffer.from(fresh.resetCodeHash)
  const ok = supplied.length === stored.length && crypto.timingSafeEqual(supplied, stored)
  if (!ok) {
    await sequelize.query('UPDATE users SET reset_code_attempts = reset_code_attempts + 1 WHERE id = :id', { replacements: { id: fresh.id } })
    throw new AppError(503, 'Invalid code')
  }
  if (consume) await userRepository.updateById(fresh.id, { resetCodeHash: null, resetCodeExpiresAt: null, resetCodeAttempts: 0 })
}

async function findActiveByEmail (email) {
  const user = await userRepository.findByEmail(email)
  if (!user) throw new AppError(501, 'User does not exists')
  if (!user.isActivated) throw new AppError(502, 'User is deactivated')
  return user
}

const requestPasswordReset = async (email) => issueCode(await findActiveByEmail(email), 'password')
const checkPasswordResetCode = async (email, code) => checkCode(await findActiveByEmail(email), 'password', code)

async function resetPasswordWithCode (email, code, newPassword) {
  const user = await findActiveByEmail(email)
  await checkCode(user, 'password', code, { consume: true })
  // resetting a password signs out every device
  await userRepository.updateById(user.id, { passwordHash: await hashSecret(newPassword), sessionId: null, isLoggedIn: false })
}

async function changePassword (user, currentPassword, newPassword) {
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new AppError(503, 'Invalid password')
  await userRepository.updateById(user.id, { passwordHash: await hashSecret(newPassword) })
}

const requestPinReset = (user) => issueCode(user, 'pin')
const checkPinResetCode = (user, code) => checkCode(user, 'pin', code)
async function changePin (user, pin, code) {
  await checkCode(user, 'pin', code, { consume: true })
  return userRepository.updateById(user.id, { pinHash: await hashSecret(pin), pinState: true })
}

module.exports = {
  issueToken, startSession, userWithHistory, register, login, verifyPin, refreshSession, setPin,
  requestPasswordReset, checkPasswordResetCode, resetPasswordWithCode, changePassword,
  requestPinReset, checkPinResetCode, changePin, User
}
