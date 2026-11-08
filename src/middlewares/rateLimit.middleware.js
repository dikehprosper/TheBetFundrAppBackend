const rateLimit = require('express-rate-limit')
const { slowDown } = require('express-slow-down')

const off = () => process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TEST !== 'true'
const body = (message) => ({ success: 429, message })
const common = { standardHeaders: true, legacyHeaders: false, skip: off }

/** General API protection. */
const apiLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 600, message: body('Too many requests, please slow down.') })

/** Sign-in, registration and reset-code endpoints: slow guessing down. */
const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 30, message: body('Too many attempts. Please try again later.') })
const authSlowDown = slowDown({ windowMs: 15 * 60 * 1000, delayAfter: 10, delayMs: (hits) => (hits - 10) * 250, skip: off })

/** Anything that moves money. */
const moneyLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 20, message: body('Too many payment requests. Please wait a moment.') })

/** Unauthenticated payment endpoints are the easiest to abuse: tighter, per IP. */
const publicMoneyLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 10, message: body('Too many payment requests. Please wait a moment.') })

module.exports = { apiLimiter, authLimiter, authSlowDown, moneyLimiter, publicMoneyLimiter }
