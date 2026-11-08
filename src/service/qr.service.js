const { qrRepository } = require('../repositories')
const { AppError } = require('../utils/handlers')
const V = require('../utils/variables.helper')

/**
 * QR deposits: a logged-in user creates a QR code (bet id + amount). Whoever scans it can pay
 * WITHOUT logging in. Rules kept from the original: valid for 1 hour, at most 20 per user per 24 hours.
 * New: a code can be paid once (claimed atomically), the `used` flag always intended that.
 */
async function generate ({ user, betId, amount, service }) {
  const since = new Date(Date.now() - V.QR_DAY_WINDOW_MS)
  const count = await qrRepository.countSince(user.id, since)
  if (count >= V.QR_MAX_PER_DAY) {
    throw new AppError(429, 'You have reached the limit of QR codes for today. Try again later.')
  }
  const qr = await qrRepository.create({
    userId: user.id,
    email: user.email,
    fullname: user.fullname,
    betId,
    amount,
    service,
    validUntil: new Date(Date.now() + V.QR_VALIDITY_MS)
  })
  return qr
}

/** Reports (and records) whether a code has expired. */
async function checkValidity (id) {
  const qr = await qrRepository.findById(id)
  if (!qr) throw new AppError(404, 'QR code not found')
  if (qr.qrcodeStatus === 'Pending' && qr.validUntil.getTime() <= Date.now()) {
    await qrRepository.markExpired(qr.id)
    qr.qrcodeStatus = 'Expired'
  }
  return qr
}

const listOpenIds = async () => (await qrRepository.listOpen()).map((row) => row.id)

module.exports = { generate, checkValidity, listOpenIds }
