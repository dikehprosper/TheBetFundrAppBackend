const { fetchWithTimeout } = require('./http')

/**
 * Fedapay collection. Flow kept from the original:
 *   1. make the Fedapay customer carry the paying phone number,
 *   2. create a Fedapay transaction and a token for it,
 *   3. ask Fedapay to push the mobile-money prompt for the chosen network.
 * Settlement is not in this service: the transaction stays Pending (see README, open issues).
 */
let sdk = null
function fedapaySdk () {
  if (!sdk) {
    sdk = require('fedapay')
  }
  sdk.FedaPay.setApiKey(process.env.FEDAPAY_KEY1)
  sdk.FedaPay.setEnvironment(process.env.FEDAPAY_ENVIRONMENT || 'sandbox')
  return sdk
}

const authHeaders = () => ({ Authorization: `Bearer ${process.env.FEDAPAY_KEY1}`, 'Content-Type': 'application/json' })
const MSISDN_COUNTRY = () => ({ prefix: process.env.MSISDN_PREFIX || '229', country: process.env.MSISDN_COUNTRY || 'BJ' })

async function updateCustomerPhone (customerId, email, number) {
  const { prefix, country } = MSISDN_COUNTRY()
  const response = await fetchWithTimeout(`${process.env.FEDAPAY_CUSTOMER_API_URL}${customerId}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ email, phone_number: { number: `+${prefix}${number}`, country } })
  })
  return response.ok
}

/** Returns an existing customer id, or creates the Fedapay customer (the old code assumed it existed). */
async function ensureCustomer ({ fedapayId, email, fullname, phoneNumber }) {
  if (fedapayId) return String(fedapayId)
  const { Customer } = fedapaySdk()
  const { prefix, country } = MSISDN_COUNTRY()
  const [firstname, lastname] = String(fullname).trim().split(/\s+/)
  const customer = await Customer.create({
    firstname,
    lastname: lastname || firstname,
    email,
    phone_number: { number: `+${prefix}${phoneNumber}`, country }
  })
  return String(customer.id)
}

/**
 * Start a collection. Throws { rejected: true } when Fedapay refuses the prompt.
 * `chargeAmount` is the amount Fedapay is asked to collect (already reduced by the provider fee).
 */
async function initiateCollection ({ chargeAmount, email, momoNumber, registeredNumber, customerId, network }) {
  const { Transaction } = fedapaySdk()
  try {
    if (momoNumber !== registeredNumber) await updateCustomerPhone(customerId, email, momoNumber)

    const transaction = await Transaction.create({
      description: 'Deposit',
      amount: Number(chargeAmount),
      callback_url: `${process.env.DOMAIN}${process.env.FEDAPAY_CALLBACK_PATH || '/payments'}`,
      currency: { iso: 'XOF' },
      customer: { email }
    })
    const token = await transaction.generateToken()

    const response = await fetchWithTimeout(`${process.env.FEDAPAY_PAY_API_URL}${network}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ token: token.token })
    })
    if (response.status !== 200) {
      const error = new Error('Fedapay refused the payment request')
      error.rejected = true
      throw error
    }
    return { providerTransactionId: String(transaction.id) }
  } finally {
    // put the customer's registered phone number back, as the original did
    if (momoNumber !== registeredNumber && customerId) {
      await updateCustomerPhone(customerId, email, registeredNumber).catch(() => {})
    }
  }
}

module.exports = { initiateCollection, ensureCustomer }
