const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const sharp = require('sharp')
const { models, setupDatabase, resetDatabase, createUser, balanceOf, closeDatabase, startServer, stopServer, tokenFor, api } = require('./helpers')
const providers = require('../src/service/providers')
const wallet = require('../src/service/wallet.service')
const authService = require('../src/service/auth.service')

before(async () => { await setupDatabase(); await startServer() })
beforeEach(resetDatabase)
after(async () => { await stopServer(); await closeDatabase() })

const fund = (userId, amount) => wallet.runInTransaction((t) => wallet.credit(userId, amount, 'adjustment', null, t))
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex')
const register = (overrides = {}) => api('/api/usersWithoutToken/register', {
  method: 'POST', body: { fullname: 'Ada Lovelace', email: 'ada@example.com', password: 'Secret123', betId: '123456', number: '97000000', ...overrides }
})
const setResetCode = (user, purpose, code, { expired = false } = {}) => models.User.update({
  resetCodeHash: sha(`${purpose}:${user.id}:${code}`),
  resetCodeExpiresAt: new Date(Date.now() + (expired ? -1000 : 600000)),
  resetCodeAttempts: 0
}, { where: { id: user.id } })

// ------------------------------------------------------------- health + basics
test('health reports the database is up', async () => {
  const r = await api('/health')
  assert.equal(r.status, 200)
  assert.equal(r.body.database, 'up')
})

test('unknown routes return a JSON 404 and malformed JSON a 400 (never a stack trace)', async () => {
  assert.equal((await api('/nope')).status, 404)
  const r = await fetch(`${await startServer()}/api/usersWithoutToken/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad json' })
  assert.equal(r.status, 400)
  assert.ok(!(await r.text()).includes('at '))
})

// ------------------------------------------------------------------ register
test('register creates the user, a tag, and returns a token; secrets never appear in the response', async () => {
  const r = await register()
  assert.equal(r.status, 200)
  assert.equal(r.body.success, true)
  assert.ok(r.body.token)
  assert.match(r.body.savedUser.tag, /^lamedcash-Ada\d+$/)
  assert.ok(!/passwordHash|pinHash|\$2[aby]\$/.test(r.text), 'no hashes in responses')
  const row = await models.User.findOne({ where: { email: 'ada@example.com' } })
  assert.notEqual(row.passwordHash, 'Secret123')
  assert.match(row.passwordHash, /^\$2[aby]\$/)
})

test('email validation checks syntax only, so addresses on newer or unusual TLDs are accepted', async () => {
  for (const email of ['person@company.technology', 'admin@smoke.test', 'a.b+tag@sub.example.internal']) {
    const r = await register({ email })
    assert.equal(r.status, 200, email)
  }
  for (const bad of ['plainaddress', '@no-local.com', 'two@@at.com', 'spaces in@x.com']) {
    assert.equal((await register({ email: bad })).status, 422, bad)
  }
})

test('register: duplicate email is 400 (case-insensitive), bad input is 422', async () => {
  await register()
  assert.equal((await register({ email: 'ADA@example.com' })).status, 400)
  const bad = await register({ email: 'not-an-email', password: '12' })
  assert.equal(bad.status, 422)
  assert.ok(bad.body.details.length >= 1)
})

test('register with a referrer tag links the referrer; an unknown tag answers HTTP 200 with success 503 (legacy shape)', async () => {
  const first = await register()
  const referral = await register({ email: 'bob@example.com', fullname: 'Bob B', referrerId: first.body.savedUser.tag })
  assert.equal(referral.status, 200)
  const bob = await models.User.findOne({ where: { email: 'bob@example.com' } })
  assert.equal(bob.referrerId, first.body.savedUser.id)
  const missing = await register({ email: 'cy@example.com', referrerId: 'lamedcash-nobody1' })
  assert.equal(missing.status, 200)
  assert.equal(missing.body.success, 503)
})

test('there is no hardcoded admin backdoor: registering the old admin credentials makes an ordinary user', async () => {
  const r = await register({ fullname: 'Sneaky', email: 'lamedcashAdmin@gmail.com', password: 'lamedcashAdmin' })
  const row = await models.User.findOne({ where: { email: 'lamedcashadmin@gmail.com' } })
  assert.equal(r.status, 200)
  assert.equal(row.role, 'user')
  const adminRoute = await api('/api/predictions/createLeague', { method: 'POST', token: r.body.token, body: { league: 'X' } })
  assert.equal(adminRoute.status, 403)
})

// --------------------------------------------------------------------- login
test('login error codes keep the original order: 501 unknown, 502 deactivated, 503 bad password, 504 PIN not set', async () => {
  assert.equal((await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'ghost@example.com', password: 'whatever1' } })).body.success, 501)

  const user = await createUser({ email: 'dead@example.com', isActivated: false })
  const deactivated = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'dead@example.com', password: 'WRONG-password' } })
  assert.equal(deactivated.status, 502) // deactivated wins over a wrong password

  await createUser({ email: 'live@example.com' })
  const wrong = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'live@example.com', password: 'nope-nope' } })
  assert.equal(wrong.status, 503)

  await register({ email: 'nopin@example.com' })
  const noPin = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'nopin@example.com', password: 'Secret123' } })
  assert.equal(noPin.status, 504)
  assert.equal(noPin.body.email, 'nopin@example.com')
  assert.ok(user)
})

test('login succeeds with PIN set: token, auth-token header, history included, no hashes', async () => {
  const user = await createUser({ email: 'ok@example.com' })
  await fund(user.id, '100')
  const r = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'ok@example.com', password: 'Password1!' } })
  assert.equal(r.status, 200)
  assert.ok(r.body.token)
  assert.equal(r.headers.get('auth-token'), r.body.token)
  assert.equal(r.body.savedUser.bonusBalance, 100)
  assert.ok(!/passwordHash|pinHash|\$2[aby]\$/.test(r.text))
})

// -------------------------------------------------------------- token checks
test('protected routes reject missing, malformed, tampered and expired tokens', async () => {
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST' })).status, 403)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: 'garbage' })).status, 403)
  const user = await createUser()
  const good = await tokenFor(user)
  const tampered = good.slice(0, -3) + (good.endsWith('abc') ? 'xyz' : 'abc')
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: tampered })).status, 403)
  const jwt = require('jsonwebtoken')
  const expired = jwt.sign({ id: user.id, sessionId: 'x' }, process.env.ACCESS_TOKEN_PRIVATE_KEY, { expiresIn: -10 })
  const r = await api('/api/users/getUpdatedData', { method: 'POST', token: expired })
  assert.equal(r.status, 403)
  assert.match(r.body.message, /expired/i)
})

test('a token signed with the wrong algorithm (alg none) is rejected', async () => {
  const user = await createUser()
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ id: user.id })).toString('base64url')
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: `${header}.${payload}.` })).status, 403)
})

test('signing in again invalidates the previous device session', async () => {
  const user = await createUser({ email: 'two@example.com' })
  const oldToken = await tokenFor(user)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: oldToken })).status, 201)
  const login = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'two@example.com', password: 'Password1!' } })
  assert.equal(login.status, 200)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: oldToken })).status, 403)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: login.body.token })).status, 201)
})

test('a deactivated user is locked out of an existing token immediately', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  await models.User.update({ isActivated: false }, { where: { id: user.id } })
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token })).status, 502)
})

// ------------------------------------------------------------------ PIN flows
test('setPin works once; a second setPin is refused; changing needs the emailed code', async () => {
  const reg = await register()
  const token = reg.body.token
  assert.equal((await api('/api/users/setPin', { method: 'POST', token, body: { pin: '12345' } })).status, 201)
  const again = await api('/api/users/setPin', { method: 'POST', token, body: { pin: '99999' } })
  assert.equal(again.status, 400)
  assert.equal((await api('/api/users/setPin', { method: 'POST', token, body: { pin: 'abc' } })).status, 422)
})

test('verifyUserPin: wrong PIN is 503, correct PIN returns a fresh token', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  assert.equal((await api('/api/users/verifyUserPin', { method: 'POST', token, body: { pin: '00000' } })).status, 503)
  const ok = await api('/api/users/verifyUserPin', { method: 'POST', token, body: { pin: '12345' } })
  assert.equal(ok.status, 200)
  assert.ok(ok.body.token)
})

test('changeUserPin needs a valid emailed code (a stolen token alone cannot change the PIN)', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  const noCode = await api('/api/users/changeUserPin', { method: 'POST', token, body: { pin: '54321' } })
  assert.equal(noCode.status, 422)
  await setResetCode(user, 'pin', '111111')
  const wrong = await api('/api/users/changeUserPin', { method: 'POST', token, body: { pin: '54321', code: '222222' } })
  assert.equal(wrong.status, 503)
  const right = await api('/api/users/changeUserPin', { method: 'POST', token, body: { pin: '54321', code: '111111' } })
  assert.equal(right.status, 201)
  const reuse = await api('/api/users/changeUserPin', { method: 'POST', token, body: { pin: '11111', code: '111111' } })
  assert.equal(reuse.status, 400) // code is single-use
})

// ---------------------------------------------------------- password reset
test('password reset: a correct code resets it; the account takeover hole of the old API is closed', async () => {
  const user = await createUser({ email: 'victim@example.com' })
  // The old API accepted this with NO proof at all. Now it must be refused.
  const attack = await api('/api/usersWithoutToken/resetPasswordForLoggedInUser2', { method: 'POST', body: { email: 'victim@example.com', password: 'Hacked123' } })
  assert.equal(attack.status, 422)
  const guess = await api('/api/usersWithoutToken/resetPasswordForLoggedInUser2', { method: 'POST', body: { email: 'victim@example.com', pin: '000000', password: 'Hacked123' } })
  assert.ok([400, 503].includes(guess.status))
  const stillOld = await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'victim@example.com', password: 'Password1!' } })
  assert.equal(stillOld.status, 200)

  await setResetCode(user, 'password', '424242')
  const oldToken = stillOld.body.token
  const done = await api('/api/usersWithoutToken/resetPasswordForLoggedInUser2', { method: 'POST', body: { email: 'victim@example.com', pin: '424242', password: 'BrandNew123' } })
  assert.equal(done.status, 200)
  assert.equal((await api('/api/usersWithoutToken/login', { method: 'POST', body: { email: 'victim@example.com', password: 'BrandNew123' } })).status, 200)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token: oldToken })).status, 403) // other devices signed out
})

test('reset code locks after 5 wrong guesses, even if the right code follows', async () => {
  const user = await createUser({ email: 'lock@example.com' })
  await setResetCode(user, 'password', '555555')
  for (let i = 0; i < 5; i += 1) {
    const r = await api('/api/usersWithoutToken/checkPin2', { method: 'POST', body: { email: 'lock@example.com', pin: '000000' } })
    assert.equal(r.status, 503)
  }
  const locked = await api('/api/usersWithoutToken/checkPin2', { method: 'POST', body: { email: 'lock@example.com', pin: '555555' } })
  assert.equal(locked.status, 429)
})

test('an expired reset code is refused', async () => {
  const user = await createUser({ email: 'old@example.com' })
  await setResetCode(user, 'password', '777777', { expired: true })
  const r = await api('/api/usersWithoutToken/checkPin2', { method: 'POST', body: { email: 'old@example.com', pin: '777777' } })
  assert.equal(r.status, 400)
})

test('a code issued for the PIN cannot be used to reset the password (purpose binding)', async () => {
  const user = await createUser({ email: 'purpose@example.com' })
  await setResetCode(user, 'pin', '313131')
  const r = await api('/api/usersWithoutToken/resetPasswordForLoggedInUser2', { method: 'POST', body: { email: 'purpose@example.com', pin: '313131', password: 'Another123' } })
  assert.equal(r.status, 503)
})

test('logged-in password change checks the current password', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  assert.equal((await api('/api/users/resetPasswordForLoggedInUser', { method: 'POST', token, body: { password: 'wrong', newPassword: 'Newpass123' } })).status, 503)
  assert.equal((await api('/api/users/resetPasswordForLoggedInUser', { method: 'POST', token, body: { password: 'Password1!', newPassword: 'Newpass123' } })).status, 201)
})

// ----------------------------------------------------- money over HTTP + IDOR
test('walletSend: the sender is the signed-in user; a victim id in the body changes nothing (old IDOR closed)', async () => {
  const attacker = await createUser({ fullname: 'Mallory' })
  const victim = await createUser({ fullname: 'Victim' })
  const friend = await createUser({ fullname: 'Friend' })
  await fund(victim.id, '5000')
  const token = await tokenFor(attacker)
  const r = await api('/api/users/walletSend', { method: 'POST', token, body: { id: victim.id, senderId: victim.id, recipientId: friend.id, amount: 1000 } })
  assert.equal(r.status, 506) // the ATTACKER has no money; the victim's wallet is not touched
  assert.equal(await balanceOf(victim.id), '5000.0000')
  assert.equal(await balanceOf(friend.id), '0.0000')
})

test('walletSend works end to end and returns the app response shape', async () => {
  const alice = await createUser({ fullname: 'Alice A' })
  const bob = await createUser({ fullname: 'Bob B' })
  await fund(alice.id, '2000')
  const r = await api('/api/users/walletSend', { method: 'POST', token: await tokenFor(alice), body: { recipientId: bob.id, amount: 750 } })
  assert.equal(r.status, 200)
  assert.equal(r.body.success, true)
  assert.equal(r.body.userTransaction.fundingType, 'send')
  assert.equal(r.body.user.bonusBalance, 1250)
  assert.equal(await balanceOf(bob.id), '750.0000')
})

test('walletSend refuses zero, negative, absurd and non-numeric amounts (old API allowed negatives = theft)', async () => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '1000')
  const token = await tokenFor(alice)
  for (const amount of [0, -500, '-500', 'abc', 1e21, '1e3', 10.999]) {
    const r = await api('/api/users/walletSend', { method: 'POST', token, body: { recipientId: bob.id, amount } })
    assert.ok([400, 422].includes(r.status), `amount ${amount} => ${r.status}`)
  }
  assert.equal(await balanceOf(alice.id), '1000.0000')
  assert.equal(await balanceOf(bob.id), '0.0000')
})

test('money endpoints need authentication', async () => {
  for (const path of ['walletSend', 'walletdeposit', 'withdrawal', 'deposit', 'depositWithFedapay']) {
    assert.equal((await api(`/api/users/${path}`, { method: 'POST', body: {} })).status, 403, path)
  }
})

test('walletdeposit over HTTP, idempotent with the Idempotency-Key header', async (t) => {
  const user = await createUser()
  await fund(user.id, '3000')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'success', data: { Success: true } }))
  const headers = { 'Idempotency-Key': 'http-key-001' }
  const token = await tokenFor(user)
  const body = { betId: user.betId, amount: 1000 }
  const a = await api('/api/users/walletdeposit', { method: 'POST', token, body, headers })
  const b = await api('/api/users/walletdeposit', { method: 'POST', token, body, headers })
  assert.equal(a.status, 200)
  assert.equal(a.body.message, 'Transaction fully completed')
  assert.equal(b.body.replay, true)
  assert.equal(a.body.userTransaction.id, b.body.userTransaction.id)
  assert.equal(await balanceOf(user.id), '2000.0000')
  assert.equal(recharge.mock.callCount(), 1)
})

test('deposit below the minimum or with a bad network is rejected before any money moves', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  const low = await api('/api/users/deposit', { method: 'POST', token, body: { betId: '1', amount: 50, momoNumber: '97000000', network: 'MTN' } })
  assert.equal(low.status, 400)
  const net = await api('/api/users/deposit', { method: 'POST', token, body: { betId: '1', amount: 500, momoNumber: '97000000', network: 'ORANGE' } })
  assert.equal(net.status, 422)
  assert.equal(await models.Transaction.count(), 0)
})

test('mobile-money deposit over HTTP', async (t) => {
  const user = await createUser()
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'SUCCESSFUL' }))
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'success', data: { Success: true } }))
  const r = await api('/api/users/deposit', { method: 'POST', token: await tokenFor(user), body: { betId: user.betId, amount: 2000, momoNumber: '97000000', network: 'mtn', service: 'mtn' } })
  assert.equal(r.status, 200)
  assert.equal(r.body.userTransaction.status, 'Successful')
})

test('wallet withdrawal over HTTP debits immediately; insufficient funds is 506', async () => {
  const user = await createUser()
  await fund(user.id, '1000')
  const token = await tokenFor(user)
  const ok = await api('/api/users/withdrawal', { method: 'POST', token, body: { bonusBalance: 1000, amount: 400, momoNumber: '97000000', betId: user.betId } })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.userTransaction.status, 'Pending')
  assert.equal(await balanceOf(user.id), '600.0000')
  const tooMuch = await api('/api/users/withdrawal', { method: 'POST', token, body: { bonusBalance: 1000, amount: 700, momoNumber: '97000000', betId: user.betId } })
  assert.equal(tooMuch.status, 506)
})

// --------------------------------------------------------------- QOS callback
test('provider callback: refused when not configured, refused with a wrong secret, accepted with the right one', async () => {
  delete process.env.QOS_WEBHOOK_SECRET
  assert.equal((await api('/api/usersWithoutToken/deposit', { method: 'POST', body: { transref: 'REF1', status: 'SUCCESSFUL' } })).status, 503)
  process.env.QOS_WEBHOOK_SECRET = 'top-secret-value'
  assert.equal((await api('/api/usersWithoutToken/deposit?secret=wrong', { method: 'POST', body: { transref: 'REF1', status: 'SUCCESSFUL' } })).status, 403)
  const ok = await api('/api/usersWithoutToken/deposit?secret=top-secret-value', { method: 'POST', body: { transref: 'REF1', status: 'SUCCESSFUL' } })
  assert.equal(ok.status, 200)
  assert.equal(await models.PaymentEvent.count({ where: { reference: 'REF1' } }), 1)
  delete process.env.QOS_WEBHOOK_SECRET
})

test('a forged callback cannot credit anything: unknown reference is a no-op', async () => {
  process.env.QOS_WEBHOOK_SECRET = 's3cret-s3cret'
  const recharge = require('node:test').mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'success', data: { Success: true } }))
  const r = await api('/api/usersWithoutToken/deposit?secret=s3cret-s3cret', { method: 'POST', body: { transref: 'NOT-A-REAL-REF', status: 'SUCCESSFUL' } })
  assert.equal(r.status, 200)
  assert.equal(recharge.mock.callCount(), 0)
  recharge.mock.restore()
  delete process.env.QOS_WEBHOOK_SECRET
})

// ------------------------------------------------------------ QR over HTTP
test('QR flow over HTTP: generate, validate, pay without logging in, cannot be reused', async (t) => {
  const owner = await createUser()
  const gen = await api('/api/users/generateQRCode', { method: 'POST', token: await tokenFor(owner), body: { betId: owner.betId, amount: 1500, service: 'mtn' } })
  assert.equal(gen.status, 201)
  const qrId = gen.body.qrId
  assert.equal((await api('/api/usersWithoutToken/checkQRCodeValidity', { method: 'POST', body: { qrId } })).status, 200)
  assert.ok((await api('/api/usersWithoutToken/getQRCode')).body.qrCodes.includes(qrId))

  t.mock.method(providers.qos, 'collect', async () => ({ status: 'SUCCESSFUL' }))
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'success', data: { Success: true } }))
  const pay = await api('/api/usersWithoutToken/noLogindeposit', { method: 'POST', body: { qrId, momoNumber: '97000009', network: 'MOOV', momoName: 'Payer Person' } })
  assert.equal(pay.status, 200)
  assert.equal(pay.body.userTransaction.status, 'Successful')
  const again = await api('/api/usersWithoutToken/noLogindeposit', { method: 'POST', body: { qrId, momoNumber: '97000009', network: 'MOOV' } })
  assert.equal(again.status, 400)
})

test('QR is given back when the payment provider fails, so the payer can retry', async (t) => {
  const owner = await createUser()
  const gen = await api('/api/users/generateQRCode', { method: 'POST', token: await tokenFor(owner), body: { betId: owner.betId, amount: 1500, service: 'mtn' } })
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'FAILED' }))
  const pay = await api('/api/usersWithoutToken/noLogindeposit', { method: 'POST', body: { qrId: gen.body.qrId, momoNumber: '97000009', network: 'MTN' } })
  assert.equal(pay.body.userTransaction.status, 'Failed')
  assert.equal((await api('/api/usersWithoutToken/checkQRCodeValidity', { method: 'POST', body: { qrId: gen.body.qrId } })).status, 200)
})

// ------------------------------------------------------------ profile + misc
test('setTag: format is validated and tags are unique case-insensitively', async () => {
  const a = await createUser()
  const b = await createUser()
  const ta = await tokenFor(a)
  const tb = await tokenFor(b)
  assert.equal((await api('/api/users/setTag', { method: 'POST', token: ta, body: { tag: 'ab' } })).status, 422)
  assert.equal((await api('/api/users/setTag', { method: 'POST', token: ta, body: { tag: 'Cool_Name' } })).status, 201)
  assert.equal((await api('/api/users/setTag', { method: 'POST', token: tb, body: { tag: 'cool_name' } })).status, 409)
})

test('referral list shows names and progress, never email addresses', async () => {
  const referrer = await createUser()
  await createUser({ referrerId: referrer.id, email: 'private-person@example.com', fullname: 'Private Person' })
  const r = await api('/api/users/getTotalReferral', { method: 'POST', token: await tokenFor(referrer) })
  assert.equal(r.body.totalReferrals, 1)
  assert.ok(!r.text.includes('private-person@example.com'))
})

test('search for a recipient returns public fields only and never the caller', async () => {
  const me = await createUser({ fullname: 'Searcher One' })
  await createUser({ fullname: 'Searchable Two', tag: 'lamedcash-two', email: 'two-secret@example.com' })
  const r = await api('/api/users/searchSendingPage', { method: 'POST', token: await tokenFor(me), body: { query: 'search' } })
  assert.equal(r.body.users.length, 1)
  assert.deepEqual(Object.keys(r.body.users[0]).sort(), ['_id', 'fullname', 'id', 'image', 'tag'])
  assert.ok(!r.text.includes('two-secret'))
})

test('profile image upload: a real image is re-encoded and stored; a fake image is refused', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#2563eb' } }).png().toBuffer()
  const form = new FormData()
  form.append('image', new Blob([png], { type: 'image/png' }), 'me.png')
  const ok = await api('/api/users/editProfileImage', { method: 'POST', token, form })
  assert.equal(ok.status, 201)
  assert.match(ok.body.image, /profiles\//)

  const fake = new FormData()
  fake.append('image', new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'evil.png')
  const bad = await api('/api/users/editProfileImage', { method: 'POST', token, form: fake })
  assert.equal(bad.status, 400)

  const wrongType = new FormData()
  wrongType.append('image', new Blob(['hello'], { type: 'text/html' }), 'x.html')
  assert.equal((await api('/api/users/editProfileImage', { method: 'POST', token, form: wrongType })).status, 400)
})

test('account deletion request needs the password, deactivates the account and ends the session', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  assert.equal((await api('/api/users/submitDeleteAccountForm', { method: 'POST', token, body: { password: 'wrong' } })).status, 503)
  assert.equal((await api('/api/users/submitDeleteAccountForm', { method: 'POST', token, body: { password: 'Password1!' } })).status, 201)
  assert.equal((await models.User.findByPk(user.id)).isActivated, false)
  assert.equal(await models.AccountDeletionRequest.count({ where: { userId: user.id } }), 1)
  assert.equal((await api('/api/users/getUpdatedData', { method: 'POST', token })).status, 502) // deactivated
})

test('feature flags can switch a route off from the environment', async () => {
  process.env.FEATURE_TRANSFERS = 'false'
  const user = await createUser()
  const r = await api('/api/users/walletSend', { method: 'POST', token: await tokenFor(user), body: {} })
  assert.equal(r.status, 503)
  delete process.env.FEATURE_TRANSFERS
})

test('support info and policies are served from configuration and files', async () => {
  const token = await tokenFor(await createUser())
  process.env.SUPPORT_EMAIL = 'help@example.com'
  const socials = await api('/api/users/getSocials', { token })
  assert.equal(socials.body.data.email, 'help@example.com')
  const policy = await api('/api/users/privacy-policies', { token })
  assert.ok(policy.body.english.length > 50)
  delete process.env.SUPPORT_EMAIL
})

// ---------------------------------------------------------------- predictions
test('predictions: anyone signed in can read, only admins can write', async () => {
  const admin = await createUser({ role: 'admin' })
  const user = await createUser()
  const adminToken = await tokenFor(admin)
  const userToken = await tokenFor(user)
  const body = { team1: 'A', team2: 'B', league: 'L', tip: '1', time: '18:00', status: 'pending' }

  assert.equal((await api('/api/predictions/createMatchPrediction', { method: 'POST', token: userToken, body })).status, 403)
  const created = await api('/api/predictions/createMatchPrediction', { method: 'POST', token: adminToken, body })
  assert.equal(created.status, 201)
  await api('/api/predictions/createMatchPrediction2', { method: 'POST', token: adminToken, body: { ...body, team1: 'C' } })

  const list1 = await api('/api/predictions/getAllMatchPrediction', { token: userToken })
  const list2 = await api('/api/predictions/getAllMatchPrediction2', { token: userToken })
  assert.equal(list1.body.data.length, 1)
  assert.equal(list2.body.data[0].team1, 'C') // the two lists are independent

  const id = created.body.matchPrediction.id
  assert.equal((await api('/api/predictions/updateMatchPrediction', { method: 'POST', token: adminToken, body: { id, status: 'won' } })).body.matchPrediction.status, 'won')
  assert.equal((await api('/api/predictions/deleteMatchPrediction', { method: 'POST', token: userToken, body: { id } })).status, 403)
  assert.equal((await api('/api/predictions/deleteMatchPrediction', { method: 'POST', token: adminToken, body: { id } })).status, 200)
  assert.equal((await api('/api/predictions/deleteMatchPrediction2', { method: 'POST', token: adminToken, body: { id } })).status, 404) // list 2 does not own it
})

test('predictions: admin can create leagues/teams with images; duplicates are refused', async () => {
  const admin = await createUser({ role: 'admin' })
  const token = await tokenFor(admin)
  const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#10b981' } }).png().toBuffer()
  const make = () => { const f = new FormData(); f.append('league', 'Premier'); f.append('image', new Blob([png], { type: 'image/png' }), 'l.png'); return f }
  assert.equal((await api('/api/predictions/createLeague', { method: 'POST', token, form: make() })).status, 201)
  assert.equal((await api('/api/predictions/createLeague', { method: 'POST', token, form: make() })).status, 409)
  const leagues = await api('/api/predictions/getLeague', { method: 'POST', token })
  assert.equal(leagues.body.leagues.length, 1)
  assert.match(leagues.body.leagues[0].image, /leagues\//)
})

// --------------------------------------------------------------------- social
test('social: post, like, comment, view, save and the shape clients read', async () => {
  const author = await createUser({ fullname: 'Author A' })
  const reader = await createUser({ fullname: 'Reader R' })
  const at = await tokenFor(author)
  const rt = await tokenFor(reader)

  const form = new FormData()
  form.append('body', 'Hello world')
  const created = await api('/api/posts/createPost', { method: 'POST', token: at, form })
  assert.equal(created.status, 201)
  const postId = created.body.post.id

  assert.equal((await api('/api/posts/like', { method: 'POST', token: rt, body: { postId } })).body.liked, true)
  assert.equal((await api('/api/posts/like', { method: 'POST', token: rt, body: { postId } })).body.liked, false)
  await api('/api/posts/like', { method: 'POST', token: rt, body: { postId } })
  await api('/api/posts/comment', { method: 'POST', token: rt, body: { postId, comment: 'Nice' } })
  await api('/api/posts/view', { method: 'POST', token: rt, body: { postId } })
  await api('/api/posts/view', { method: 'POST', token: rt, body: { postId } }) // idempotent
  assert.equal((await api(`/api/posts/saved?postId=${postId}`, { method: 'PUT', token: rt })).body.message, 'Saved Post')

  const feed = await api('/api/posts', { token: rt })
  assert.equal(feed.status, 200)
  const post = feed.body[0]
  assert.equal(post.likeCount, 1)
  assert.equal(post.viewCount, 1)
  assert.equal(post.commentCount, 1)
  assert.deepEqual(post.saves, [reader.id])
  assert.equal(post.user.fullname, 'Author A')
  assert.ok(!JSON.stringify(post).includes('email'))

  const notifications = await models.Notification.findAll({ where: { toUserId: author.id } })
  assert.deepEqual(notifications.map((n) => n.type).sort(), ['comment', 'like', 'like'])
})

test('social: only the owner can edit or delete a post or comment (old API had no ownership checks)', async () => {
  const author = await createUser()
  const other = await createUser()
  const at = await tokenFor(author)
  const ot = await tokenFor(other)
  const form = new FormData()
  form.append('body', 'mine')
  const postId = (await api('/api/posts/createPost', { method: 'POST', token: at, form })).body.post.id

  assert.equal((await api('/api/posts', { method: 'PATCH', token: ot, body: { postId, postUpdate: 'hijacked' } })).status, 403)
  assert.equal((await api(`/api/posts?postId=${postId}`, { method: 'DELETE', token: ot })).status, 403)

  const comment = (await api('/api/posts/comment', { method: 'POST', token: ot, body: { postId, comment: 'hi' } })).body.comment
  assert.equal((await api(`/api/posts/comment?commentId=${comment.id}`, { method: 'PATCH', token: at, body: { description: 'edited by someone else' } })).status, 403)
  assert.equal((await api(`/api/posts/comment?commentId=${comment.id}`, { method: 'DELETE', token: at })).status, 200) // the post owner may remove it
  assert.equal((await api(`/api/posts?postId=${postId}`, { method: 'DELETE', token: at })).status, 200)
  assert.equal(await models.Post.count(), 0)
  assert.equal(await models.Comment.count(), 0) // cascades
})

test('social: following feed, follow toggle and public profile hide private data', async () => {
  const a = await createUser({ fullname: 'Alice' })
  const b = await createUser({ fullname: 'Bob', email: 'bob-private@example.com' })
  await fund(b.id, '999')
  const at = await tokenFor(a)
  const bt = await tokenFor(b)
  const form = new FormData(); form.append('body', 'from bob')
  await api('/api/posts/createPost', { method: 'POST', token: bt, form })

  assert.deepEqual((await api('/api/posts/following', { token: at })).body, [])
  assert.equal((await api('/api/users/actions/follow', { method: 'PUT', token: at, body: { userId: b.id } })).body.following, true)
  assert.equal((await api('/api/posts/following', { token: at })).body.length, 1)
  assert.equal((await api('/api/users/actions/follow', { method: 'PUT', token: at, body: { userId: a.id } })).status, 400)

  const profile = await api(`/api/users/actions/data?userId=${b.id}`, { token: at })
  assert.equal(profile.body.followerCount, 1)
  assert.equal(profile.body.isFollowing, true)
  assert.ok(!profile.text.includes('bob-private') && !profile.text.includes('999'))
  assert.equal((await api('/api/users/actions/follow', { method: 'PUT', token: at, body: { userId: b.id } })).body.following, false)
})

test('social: uploads are validated (fake image refused, nothing half-saved)', async () => {
  const user = await createUser()
  const token = await tokenFor(user)
  const form = new FormData()
  form.append('body', 'with a bad file')
  form.append('images', new Blob(['not really a png'], { type: 'image/png' }), 'a.png')
  const r = await api('/api/posts/createPost', { method: 'POST', token, form })
  assert.equal(r.status, 400)
  assert.equal(await models.Post.count(), 0)
})

// ------------------------------------------------------------------- fixtures
test('fixtures: fetched once and cached; leagues and standings respect their freshness windows', async (t) => {
  const fixtures = t.mock.method(providers.sports, 'fixturesForDate', async () => [{ fixture: { id: 1 } }])
  const a = await api('/api/fixtures?date=2026-11-07')
  const b = await api('/api/fixtures?date=2026-11-07')
  assert.deepEqual(a.body.data, [{ fixture: { id: 1 } }])
  assert.deepEqual(b.body.data, a.body.data)
  assert.equal(fixtures.mock.callCount(), 1)

  const leagues = t.mock.method(providers.sports, 'leagues', async () => Array.from({ length: 80 }, (_, i) => ({ league: { id: i } })))
  assert.equal((await api('/api/fixtures/leagues')).body.data.length, 50)
  await api('/api/fixtures/leagues')
  assert.equal(leagues.mock.callCount(), 1)
  await models.ApiCache.update({ fetchedAt: new Date(Date.now() - 61 * 60 * 1000) }, { where: { kind: 'leagues' } })
  await api('/api/fixtures/leagues')
  assert.equal(leagues.mock.callCount(), 2)

  const standings = t.mock.method(providers.sports, 'standings', async () => [{ s: 1 }])
  await api('/api/fixtures/standings?league=39&season=2026')
  await api('/api/fixtures/standings?league=39&season=2026')
  assert.equal(standings.mock.callCount(), 1)
  await models.ApiCache.update({ fetchedAt: new Date(Date.now() - 13 * 3600 * 1000) }, { where: { kind: 'standings' } })
  await api('/api/fixtures/standings?league=39&season=2026')
  assert.equal(standings.mock.callCount(), 2)
})

test('fixtures: a missing parameter is 400, a provider outage serves the stale copy or a clean 502 (no internals leaked)', async (t) => {
  assert.equal((await api('/api/fixtures')).status, 400)
  t.mock.method(providers.sports, 'events', async () => { const e = new Error('key=SECRET boom'); e.status = 502; throw e })
  const down = await api('/api/fixtures/events?fixture=9')
  assert.equal(down.status, 502)
  assert.ok(!down.text.includes('SECRET'))
  await models.ApiCache.create({ kind: 'lineups', cacheKey: '7', payload: [{ ok: true }] })
  t.mock.method(providers.sports, 'lineups', async () => { throw new Error('down') })
  assert.deepEqual((await api('/api/fixtures/lineups?fixture=7')).body.data, [{ ok: true }])
})

test('fixtures: game refresh writes the new score back into the cached day', async (t) => {
  await models.ApiCache.create({ kind: 'fixtures', cacheKey: '2026-11-07', payload: [{ fixture: { id: 5, status: 'NS' }, goals: { home: null }, teams: {}, league: {}, score: {} }] })
  t.mock.method(providers.sports, 'headToHead', async () => [{ fixture: { id: 5, status: 'FT' }, goals: { home: 3 }, teams: { a: 1 }, league: { n: 1 }, score: { ft: '3-0' } }])
  const r = await api('/api/fixtures/game?h2h=1-2&date=2026-11-07')
  assert.equal(r.body.data.goals.home, 3)
  const cached = (await models.ApiCache.findOne({ where: { kind: 'fixtures', cacheKey: '2026-11-07' } })).payload
  assert.equal(cached[0].fixture.status, 'FT')
})

// -------------------------------------------------------------------- errors
test('unexpected server errors return a generic 500 and leak nothing', async (t) => {
  const user = await createUser()
  const token = await tokenFor(user)
  t.mock.method(require('../src/service/user.service'), 'searchUsers', async () => { throw new Error('select * from users where password=hunter2') })
  const r = await api('/api/users/searchSendingPage', { method: 'POST', token, body: { query: 'x' } })
  assert.equal(r.status, 500)
  assert.ok(!r.text.includes('hunter2') && !r.text.includes('select'))
  assert.ok(authService)
})
