// Business constants preserved from the original application.
module.exports = {
  // deposit rules
  MIN_DEPOSIT_AMOUNT: 100,
  DUPLICATE_DEPOSIT_WINDOW_MS: 5 * 60 * 1000,
  // 3% x 33% of every successful deposit is credited to the referrer's wallet (was calculatePercentage)
  REFERRAL_BONUS_RATE: '0.0099',
  // Fedapay is asked to collect amount - 1.8% (rounded). Configurable, defaults to the original value.
  FEDAPAY_PROVIDER_FEE_PERCENT: process.env.FEDAPAY_PROVIDER_FEE_PERCENT || '1.8',
  // QR deposit rules
  QR_VALIDITY_MS: 60 * 60 * 1000,
  QR_MAX_PER_DAY: 20,
  QR_DAY_WINDOW_MS: 24 * 60 * 60 * 1000,

  NETWORKS: { MTN: 'MTN', MOOV: 'MOOV' },

  TRANSACTION_STATUS: { PENDING: 'Pending', SUCCESSFUL: 'Successful', FAILED: 'Failed' },
  FUNDING_TYPE: { DEPOSITS: 'deposits', WITHDRAWALS: 'withdrawals', SEND: 'send', RECEIVE: 'receive', BONUS: 'bonus' },

  LEDGER: {
    DEPOSIT_HOLD: 'deposit_hold',
    DEPOSIT_REFUND: 'deposit_refund',
    WITHDRAWAL_HOLD: 'withdrawal_hold',
    WITHDRAWAL_REFUND: 'withdrawal_refund',
    TRANSFER_OUT: 'transfer_out',
    TRANSFER_IN: 'transfer_in',
    REFERRAL_BONUS: 'referral_bonus',
    ADJUSTMENT: 'adjustment'
  },

  // Cashdesk (mobcash) message ids the original code branched on.
  CASHDESK: { ALREADY_PAID: 100337, CURRENCY_MISMATCH: 100323 },

  // Numeric codes the mobile app switches on (kept as-is for client compatibility).
  CODES: {
    INVALID_INPUT: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    DUPLICATE_DEPOSIT: 300,
    CURRENCY_MISMATCH: 301,
    USER_NOT_FOUND: 501,
    ACCOUNT_DEACTIVATED: 502,
    INVALID_PASSWORD: 503,
    PIN_NOT_SET: 504,
    EMAIL_TAKEN: 505,
    INSUFFICIENT_FUNDS: 506,
    MAINTENANCE_DEPOSITS: 504,
    MAINTENANCE_WITHDRAWALS: 405
  }
}
