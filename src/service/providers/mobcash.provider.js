const crypto = require('node:crypto')
const { fetchWithTimeout } = require('./http')

/**
 * Cashdesk API that credits / pays out the customer's betting account.
 *
 * Every call resolves to one of three outcomes. The distinction matters for money:
 *   success  - the cashdesk confirmed it.
 *   rejected - the cashdesk answered and explicitly refused. Nothing happened there.
 *   unknown  - timeout, network error, unreadable answer. It MAY have gone through, so callers
 *              must never refund or retry blindly; the transaction stays Pending for reconciliation.
 */
const LNG = 'fr'
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const md5 = (value) => crypto.createHash('md5').update(value).digest('hex') // required by the provider's signing scheme

const config = () => ({
  baseUrl: (process.env.MOBCASH_BASE_URL || 'https://partners.servcul.com/CashdeskBotAPI').replace(/\/$/, ''),
  hash: process.env.MOBCASH_HASH,
  cashierPass: process.env.MOBCASH_CASHIERPASS,
  cashdeskId: process.env.MOBCASH_CASHDESKID
})

function sign (userId, secondParam) {
  const { hash, cashierPass, cashdeskId } = config()
  const initial = sha256(`hash=${hash}&lng=${LNG}&userid=${userId}`)
  const params = md5(`${secondParam}&cashierpass=${cashierPass}&cashdeskid=${cashdeskId}`)
  return { sign: sha256(initial + params), confirm: md5(`${userId}:${hash}`) }
}

async function call (path, body, signature) {
  try {
    const response = await fetchWithTimeout(`${config().baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Sign: signature },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    if (data && data.Success === true) return { outcome: 'success', data }
    if (data && data.Success === false) return { outcome: 'rejected', data, messageId: data.MessageId, message: data.Message }
    return { outcome: 'unknown', data }
  } catch (error) {
    return { outcome: 'unknown', error: error.name === 'AbortError' ? 'timeout' : error.message }
  }
}

/** Credit `amount` to the betting account `betId`. */
function rechargeAccount (betId, amount) {
  const { cashdeskId } = config()
  const { sign: signature, confirm } = sign(betId, `summa=${amount}`)
  return call(`/Deposit/${encodeURIComponent(betId)}/Add`, { cashdeskid: cashdeskId, lng: LNG, summa: Number(amount), confirm }, signature)
}

/** Redeem a withdrawal `code` generated on the betting account. Success data contains `Summa`. */
function withdrawFromAccount (betId, code) {
  const { cashdeskId } = config()
  const { sign: signature, confirm } = sign(betId, `code=${code}`)
  return call(`/Deposit/${encodeURIComponent(betId)}/Payout`, { cashdeskid: cashdeskId, lng: LNG, code, confirm }, signature)
}

module.exports = { rechargeAccount, withdrawFromAccount }
