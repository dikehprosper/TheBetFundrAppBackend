const crypto = require('node:crypto')

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** Unpredictable 15 character reference (the original used a timestamp prefix + Math.random). */
function generateReference (length = 15) {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** Six digit one-time code for PIN / password reset emails. */
function generateCode () {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0')
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

module.exports = { generateReference, generateCode, sha256 }
