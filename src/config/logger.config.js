const pino = require('pino')

// Never write credentials, tokens, PINs or full phone numbers to logs.
const logger = pino({
  level: process.env.NODE_ENV === 'test' ? 'silent' : (process.env.PINO_LOG_LEVEL || 'info'),
  messageKey: 'message',
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie',
      '*.password', '*.newPassword', '*.currentPassword', '*.pin', '*.newPin', '*.pinCode',
      '*.token', '*.accessToken', '*.password_hash', '*.pin_hash', '*.momoNumber', '*.withdrawalCode',
      'password', 'pin', 'token'
    ],
    censor: '[redacted]'
  }
})

module.exports = logger
