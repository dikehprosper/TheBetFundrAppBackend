const jwt = require('jsonwebtoken')
const { userRepository } = require('../repositories')
const { asyncHandler, AppError } = require('../utils/handlers')

function extractToken (req) {
  const header = req.headers.authorization
  if (header && /^Bearer\s+/i.test(header)) return header.split(/\s+/)[1]
  return req.headers['auth-token'] || null
}

function decode (token) {
  try {
    return jwt.verify(token, process.env.ACCESS_TOKEN_PRIVATE_KEY, { algorithms: [process.env.ACCESS_TOKEN_ALGORITHM || 'HS256'] })
  } catch (error) {
    if (error.name === 'TokenExpiredError') throw new AppError(403, 'Token expired', { code: 403 })
    throw new AppError(403, 'Token is not valid', { code: 403 })
  }
}

/**
 * Authenticates the request and loads the CURRENT user from the database (never trusts claims
 * for authorisation). Rejects deactivated accounts and, for non-admins, tokens from a session
 * that a newer sign-in replaced. `req.user` is the identity every handler must act as.
 */
const verifyToken = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req)
  if (!token) throw new AppError(403, 'Authorization header missing', { code: 403 })
  const claims = decode(token)
  const user = await userRepository.findById(claims.id)
  if (!user) throw new AppError(403, 'Token is not valid', { code: 403 })
  if (!user.isActivated) throw new AppError(502, 'User is deactivated')
  const enforce = process.env.ENFORCE_SINGLE_SESSION !== 'false' && user.role !== 'admin'
  if (enforce && (!user.sessionId || user.sessionId !== claims.sessionId)) {
    throw new AppError(403, 'Session expired. Please sign in again.', { code: 403 })
  }
  req.user = user
  req.token = token
  next()
})

module.exports = { verifyToken, extractToken, decode }
