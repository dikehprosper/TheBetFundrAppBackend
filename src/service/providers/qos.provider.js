const { fetchWithTimeout } = require('./http')
const { PaymentEvent } = require('../../models')

/**
 * QOS mobile-money collection (MTN / MOOV).
 * The customer approves a prompt on their phone. We then wait for the answer.
 *
 * Unlike the original (an in-process EventEmitter that only worked on a single server and
 * trusted the callback body), a callback here is only a HINT that makes us ask QOS right now.
 * The status we act on always comes from QOS's own status endpoint.
 */
const credentials = (network) => {
  const mtn = String(network).toLowerCase() === 'mtn'
  return {
    url: mtn ? process.env.QOS_STRING_FOR_MTN_PAYMENT : process.env.QOS_STRING_FOR_MOOV_PAYMENT,
    username: mtn ? process.env.QOS_USERNAME1 : process.env.QOS_USERNAME2,
    password: mtn ? process.env.QOS_PASSWORD1 : process.env.QOS_PASSWORD2,
    clientId: mtn ? process.env.QOS_CLIENTID1 : process.env.QOS_CLIENTID2
  }
}

const basicAuth = (c) => `Basic ${Buffer.from(`${c.username}:${c.password}`).toString('base64')}`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Ask QOS for the current status. Returns SUCCESSFUL | PENDING | FAILED (PENDING when unsure). */
async function checkStatus (reference, network) {
  const c = credentials(network)
  try {
    const response = await fetchWithTimeout(process.env.QOS_STRING_CHECK_TRANSACTION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: basicAuth(c) },
      body: JSON.stringify({ clientid: c.clientId, transref: reference })
    })
    const data = await response.json()
    if (data.responsemsg === 'SUCCESSFUL') return 'SUCCESSFUL'
    if (data.responsemsg === 'PENDING') return 'PENDING'
    return 'FAILED'
  } catch (_error) {
    return 'PENDING'
  }
}

/**
 * Start a collection and wait up to QOS_COLLECTION_WAIT_MS for the customer.
 * Resolves { status: 'SUCCESSFUL' | 'PENDING' | 'FAILED', providerTransactionId }.
 * 'PENDING' means we stopped waiting, not that it failed: the transaction stays Pending.
 */
async function collect ({ amount, momoNumber, network, fullname, reference }) {
  const c = credentials(network)
  const [firstname, lastname] = String(fullname).trim().split(/\s+/)
  const msisdnPrefix = process.env.MSISDN_PREFIX || '229'

  let accepted
  try {
    const response = await fetchWithTimeout(c.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: basicAuth(c) },
      body: JSON.stringify({
        msisdn: `${msisdnPrefix}${momoNumber}`,
        amount: Number(amount),
        firstname,
        lastname: lastname || firstname,
        transref: reference,
        clientid: c.clientId
      })
    })
    accepted = await response.json()
  } catch (_error) {
    // We cannot tell whether QOS received it: do not claim failure, let reconciliation decide.
    return { status: 'PENDING', providerTransactionId: reference }
  }

  if (accepted.responsemsg !== 'PENDING' && accepted.responsemsg !== 'SUCCESSFUL') {
    return { status: 'FAILED', providerTransactionId: reference }
  }

  const waitMs = Number(process.env.QOS_COLLECTION_WAIT_MS || 60000)
  const pollMs = Number(process.env.QOS_POLL_INTERVAL_MS || 3000)
  const deadline = Date.now() + waitMs
  for (;;) {
    const status = await checkStatus(reference, network)
    if (status !== 'PENDING') return { status, providerTransactionId: reference }
    if (Date.now() >= deadline) return { status: 'PENDING', providerTransactionId: reference }
    // wake early when the provider's callback has arrived
    const hint = await PaymentEvent.count({ where: { provider: 'qos', reference } })
    await sleep(hint > 0 ? Math.min(250, pollMs) : pollMs)
  }
}

module.exports = { collect, checkStatus }
