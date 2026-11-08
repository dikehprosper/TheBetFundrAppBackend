const { AppError } = require('../handlers')
const { MIN_DEPOSIT_AMOUNT } = require('../variables.helper')

/**
 * Money is exact NUMERIC in PostgreSQL. In JavaScript it travels as a decimal STRING
 * so it is never rounded through a float. This validates and normalises an incoming amount.
 */
function parseAmount (value, { min, field = 'amount' } = {}) {
  const raw = typeof value === 'number' ? String(value) : value
  if (typeof raw !== 'string' || !/^\d{1,14}(\.\d{1,2})?$/.test(raw.trim())) {
    throw new AppError(400, `Invalid ${field}`)
  }
  const normalised = raw.trim()
  const asNumber = Number(normalised)
  if (!(asNumber > 0)) throw new AppError(400, `${field} must be greater than zero`)
  if (min !== undefined && asNumber < min) throw new AppError(400, `${field} must be at least ${min}`)
  return normalised
}

const parseDepositAmount = (value) => parseAmount(value, { min: MIN_DEPOSIT_AMOUNT })

/** Rounded provider charge: round(amount - percent% of amount), as the original Fedapay path did. */
function providerChargeAmount (amount, percent) {
  const value = Number(amount)
  return String(Math.round(value - (Number(percent) / 100) * value))
}

module.exports = { parseAmount, parseDepositAmount, providerChargeAmount }
