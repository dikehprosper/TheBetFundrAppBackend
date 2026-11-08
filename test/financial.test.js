const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { models, setupDatabase, resetDatabase, createUser, balanceOf, closeDatabase } = require('./helpers')
const wallet = require('../src/service/wallet.service')
const providers = require('../src/service/providers')
const deposits = require('../src/service/deposit.service')
const withdrawals = require('../src/service/withdrawal.service')
const transfers = require('../src/service/transfer.service')
const qrService = require('../src/service/qr.service')
const { parseAmount } = require('../src/utils/helpers/money.helper')

before(setupDatabase)
beforeEach(resetDatabase)
after(closeDatabase)

const fund = (userId, amount) => wallet.runInTransaction((t) => wallet.credit(userId, amount, 'adjustment', null, t))
const cashdeskOk = { outcome: 'success', data: { Success: true } }
const qosOk = { status: 'SUCCESSFUL', providerTransactionId: 'x' }

/** The core invariant: every wallet balance equals the sum of that user's ledger. */
async function assertLedgerReconciles () {
  const rows = await models.sequelize.query(
    `SELECT u.id, u.bonus_balance::text AS balance, COALESCE(SUM(l.amount), 0)::numeric(20,4)::text AS ledger
       FROM users u LEFT JOIN ledger_entries l ON l.user_id = u.id GROUP BY u.id`,
    { type: models.sequelize.QueryTypes.SELECT }
  )
  for (const row of rows) assert.equal(row.balance, row.ledger, `ledger mismatch for ${row.id}`)
}

const deposit = (user, extra = {}) => deposits.createDeposit({
  user, mode: 'qos', betId: user.betId, amount: '1000', momoNumber: '97000000', network: 'MTN', service: 'mtn', momoName: user.fullname, ...extra
})

// ---------------------------------------------------------------- deposits
test('wallet-only deposit: wallet debited, cashdesk credited once with the full amount, Successful', async (t) => {
  const user = await createUser()
  await fund(user.id, '1500')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const result = await deposits.createDeposit({ user, mode: 'wallet', betId: user.betId, amount: '1000', service: 'wallet' })

  assert.equal(result.outcome, 'completed')
  assert.equal(result.transaction.status, 'Successful')
  assert.equal(await balanceOf(user.id), '500.0000')
  assert.equal(recharge.mock.callCount(), 1)
  assert.deepEqual(recharge.mock.calls[0].arguments, [user.betId, '1000.0000'])
  assert.equal((await models.User.findByPk(user.id)).successfulDepositCount, 1)
  await assertLedgerReconciles()
})

test('provider-only deposit: money collected, cashdesk credited, wallet untouched', async (t) => {
  const user = await createUser()
  const collect = t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const result = await deposit(user)
  assert.equal(result.outcome, 'completed')
  assert.equal(collect.mock.calls[0].arguments[0].amount, '1000.0000')
  assert.equal(await balanceOf(user.id), '0.0000')
  assert.equal(result.transaction.walletAmount, '0.0000')
})

test('partial wallet: wallet portion held, only the remainder is collected, full amount credited', async (t) => {
  const user = await createUser()
  await fund(user.id, '300')
  const collect = t.mock.method(providers.qos, 'collect', async () => qosOk)
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const result = await deposit(user, { walletClaim: 300 })
  assert.equal(collect.mock.calls[0].arguments[0].amount, '700.0000')
  assert.deepEqual(recharge.mock.calls[0].arguments, [user.betId, '1000.0000'])
  assert.equal(result.transaction.walletAmount, '300.0000')
  assert.equal(await balanceOf(user.id), '0.0000')
  await assertLedgerReconciles()
})

test('provider FAILED: transaction Failed and the wallet hold is refunded exactly once', async (t) => {
  const user = await createUser()
  await fund(user.id, '300')
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'FAILED' }))
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const result = await deposit(user, { walletClaim: 300 })
  assert.equal(result.outcome, 'failed')
  assert.equal(result.transaction.status, 'Failed')
  assert.equal(await balanceOf(user.id), '300.0000')
  assert.equal(recharge.mock.callCount(), 0)
  const entries = await models.LedgerEntry.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] })
  assert.deepEqual(entries.map((e) => e.entryType), ['adjustment', 'deposit_hold', 'deposit_refund'])
  await assertLedgerReconciles()
})

test('provider PENDING keeps funds held; a callback later settles it exactly once (no double credit, no double bonus)', async (t) => {
  const referrer = await createUser()
  const user = await createUser({ referrerId: referrer.id })
  await fund(user.id, '300')
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'PENDING' }))
  const result = await deposit(user, { walletClaim: 300 })
  assert.equal(result.outcome, 'pending')
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(await balanceOf(user.id), '0.0000') // still held

  t.mock.method(providers.qos, 'checkStatus', async () => 'SUCCESSFUL')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const [a, b, c] = await Promise.all([
    deposits.handleQosCallback(result.transaction.reference, 'SUCCESSFUL', {}),
    deposits.handleQosCallback(result.transaction.reference, 'SUCCESSFUL', {}),
    deposits.handleQosCallback(result.transaction.reference, 'SUCCESSFUL', {})
  ])
  assert.ok([a, b, c].every((r) => r.handled))
  assert.equal(recharge.mock.callCount(), 1, 'cashdesk must be credited exactly once')
  assert.equal((await models.Transaction.findByPk(result.transaction.id)).status, 'Successful')
  assert.equal(await balanceOf(referrer.id), '9.9000', 'referral bonus paid exactly once')
  assert.equal(await models.Transaction.count({ where: { fundingType: 'bonus' } }), 1)
  await assertLedgerReconciles()
})

test('a callback claiming SUCCESS is not trusted: the provider says FAILED, so the deposit fails', async (t) => {
  const user = await createUser()
  await fund(user.id, '300')
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'PENDING' }))
  const result = await deposit(user, { walletClaim: 300 })
  t.mock.method(providers.qos, 'checkStatus', async () => 'FAILED')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  await deposits.handleQosCallback(result.transaction.reference, 'SUCCESSFUL', {})
  assert.equal(recharge.mock.callCount(), 0)
  assert.equal((await models.Transaction.findByPk(result.transaction.id)).status, 'Failed')
  assert.equal(await balanceOf(user.id), '300.0000')
})

test('cashdesk REJECTS (already paid, id 100337): stays Pending with customErrorCode 300, money NOT refunded', async (t) => {
  const user = await createUser()
  await fund(user.id, '300')
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'rejected', messageId: 100337 }))
  const result = await deposit(user, { walletClaim: 300 })
  assert.equal(result.outcome, 'incomplete')
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(result.transaction.paymentConfirmation, 'Successful')
  assert.equal(result.transaction.customErrorCode, 300)
  assert.equal(await balanceOf(user.id), '0.0000')
})

test('cashdesk currency mismatch (100323) is flagged as code 301', async (t) => {
  const user = await createUser()
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'rejected', messageId: 100323 }))
  assert.equal((await deposit(user)).transaction.customErrorCode, 301)
})

test('cashdesk UNKNOWN outcome (timeout): Pending, never refunded, never retried automatically', async (t) => {
  const user = await createUser()
  await fund(user.id, '300')
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'unknown', error: 'timeout' }))
  const result = await deposit(user, { walletClaim: 300 })
  assert.equal(result.outcome, 'incomplete')
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(result.transaction.metadata.cashdesk.outcome, 'unknown')
  assert.equal(await balanceOf(user.id), '0.0000')
  // a second finalize must not call the cashdesk again
  await deposits.finalizeDeposit(result.transaction.id)
  assert.equal(recharge.mock.callCount(), 1)
})

test('referral bonus: referrer wallet +0.99% of the deposit, platform counter and bonus row recorded atomically', async (t) => {
  const referrer = await createUser()
  const user = await createUser({ referrerId: referrer.id })
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  await deposit(user)
  assert.equal(await balanceOf(referrer.id), '9.9000')
  assert.equal((await models.PlatformSettings.findByPk(1)).disbursedBonusBalance, '9.9000')
  const bonus = await models.Transaction.findOne({ where: { fundingType: 'bonus' } })
  assert.equal(bonus.userId, referrer.id)
  assert.equal(bonus.amount, '9.9000')
  await assertLedgerReconciles()
})

test('no referral bonus while the deposit is still Pending', async (t) => {
  const referrer = await createUser()
  const user = await createUser({ referrerId: referrer.id })
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => ({ outcome: 'rejected', messageId: 100337 }))
  await deposit(user)
  assert.equal(await balanceOf(referrer.id), '0.0000')
})

test('IDEMPOTENCY: the same key twice gives one transaction, one debit, one cashdesk call', async (t) => {
  const user = await createUser()
  await fund(user.id, '1000')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const args = { user, mode: 'wallet', betId: user.betId, amount: '400', service: 'wallet', idempotencyKey: 'key-1' }
  const first = await deposits.createDeposit(args)
  const second = await deposits.createDeposit(args)
  assert.equal(second.replay, true)
  assert.equal(second.transaction.id, first.transaction.id)
  assert.equal(await balanceOf(user.id), '600.0000')
  assert.equal(recharge.mock.callCount(), 1)
  assert.equal(await models.Transaction.count({ where: { userId: user.id } }), 1)
})

test('IDEMPOTENCY under concurrency: 8 simultaneous identical requests => exactly one deposit', async (t) => {
  const user = await createUser()
  await fund(user.id, '1000')
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => { await new Promise((r) => setTimeout(r, 20)); return cashdeskOk })
  const args = { user, mode: 'wallet', betId: user.betId, amount: '400', service: 'wallet', idempotencyKey: 'race-key' }
  const results = await Promise.all(Array.from({ length: 8 }, () => deposits.createDeposit(args)))
  assert.equal(new Set(results.map((r) => r.transaction.id)).size, 1)
  assert.equal(await balanceOf(user.id), '600.0000')
  assert.equal(recharge.mock.callCount(), 1)
  await assertLedgerReconciles()
})

test('CONCURRENCY: 10 simultaneous wallet deposits of 300 against 1000 => exactly 3 succeed, wallet never negative', async (t) => {
  const user = await createUser()
  await fund(user.id, '1000')
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) => deposits.createDeposit({ user, mode: 'wallet', betId: `bet-${i}`, amount: '300', service: 'wallet' }))
  )
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3)
  assert.ok(results.filter((r) => r.status === 'rejected').every((r) => r.reason.status === 506))
  assert.equal(await balanceOf(user.id), '100.0000')
  assert.equal(await models.Transaction.count({ where: { status: 'Successful' } }), 3)
  await assertLedgerReconciles()
})

test('claiming the wallet covers it while the real balance does not => 506, nothing is created or charged', async (t) => {
  const user = await createUser()
  await fund(user.id, '100')
  const collect = t.mock.method(providers.qos, 'collect', async () => qosOk)
  await assert.rejects(deposit(user, { walletClaim: 5000 }), (e) => e.status === 506)
  assert.equal(collect.mock.callCount(), 0)
  assert.equal(await balanceOf(user.id), '100.0000')
  assert.equal(await models.Transaction.count(), 0)
})

test('duplicate payment inside 5 minutes is refused up front (code 300) and nobody is charged', async (t) => {
  const user = await createUser()
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  await deposit(user)
  const collectAgain = t.mock.method(providers.qos, 'collect', async () => qosOk)
  await assert.rejects(deposit(user), (e) => e.code === 300)
  assert.equal(collectAgain.mock.callCount(), 0)
  assert.equal(await models.Transaction.count({ where: { fundingType: 'deposits' } }), 1)
})

test('deposits switched off by the platform => 504, nothing created', async () => {
  const user = await createUser()
  await models.PlatformSettings.update({ isDepositsOpen: false }, { where: { id: 1 } })
  await assert.rejects(deposit(user), (e) => e.status === 504)
  assert.equal(await models.Transaction.count(), 0)
})

test('a deactivated user cannot deposit (502)', async () => {
  const user = await createUser({ isActivated: false })
  await assert.rejects(deposit(user), (e) => e.status === 502)
})

test('two workers finalising the same confirmed deposit credit the cashdesk once', async (t) => {
  const user = await createUser()
  t.mock.method(providers.qos, 'collect', async () => ({ status: 'PENDING' }))
  const { transaction } = await deposit(user)
  const recharge = t.mock.method(providers.mobcash, 'rechargeAccount', async () => { await new Promise((r) => setTimeout(r, 30)); return cashdeskOk })
  await Promise.all([deposits.finalizeDeposit(transaction.id), deposits.finalizeDeposit(transaction.id)])
  assert.equal(recharge.mock.callCount(), 1)
  assert.equal((await models.User.findByPk(user.id)).successfulDepositCount, 1)
})

test('settled transactions are immutable: Successful cannot become Failed (database trigger)', async (t) => {
  const user = await createUser()
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const { transaction } = await deposit(user)
  await assert.rejects(
    models.sequelize.query("UPDATE transactions SET status = 'Failed' WHERE id = :id", { replacements: { id: transaction.id } }),
    /cannot become/
  )
})

// ------------------------------------------------------------- withdrawals
test('wallet withdrawal: wallet debited in the same transaction as the Pending request', async () => {
  const user = await createUser()
  await fund(user.id, '1000')
  const result = await withdrawals.createWithdrawal({ user, mode: 'wallet', amount: '400', betId: user.betId, momoNumber: '97000000', service: 'mtn' })
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(result.transaction.walletAmount, '400.0000')
  assert.equal(await balanceOf(user.id), '600.0000')
  await assertLedgerReconciles()
})

test('wallet withdrawal beyond the balance => 506 and nothing recorded', async () => {
  const user = await createUser()
  await fund(user.id, '100')
  await assert.rejects(withdrawals.createWithdrawal({ user, mode: 'wallet', amount: '101', betId: 'b', momoNumber: '1', service: 's' }), (e) => e.status === 506)
  assert.equal(await models.Transaction.count(), 0)
  assert.equal(await balanceOf(user.id), '100.0000')
})

test('CONCURRENCY: 12 simultaneous wallet withdrawals of 100 against 500 => exactly 5 succeed', async () => {
  const user = await createUser()
  await fund(user.id, '500')
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => withdrawals.createWithdrawal({ user, mode: 'wallet', amount: '100', betId: 'b', momoNumber: '1', service: 's' }))
  )
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 5)
  assert.equal(await balanceOf(user.id), '0.0000')
  assert.equal(await models.Transaction.count({ where: { fundingType: 'withdrawals' } }), 5)
  await assertLedgerReconciles()
})

test('wallet withdrawal is idempotent per key', async () => {
  const user = await createUser()
  await fund(user.id, '1000')
  const args = { user, mode: 'wallet', amount: '400', betId: 'b', momoNumber: '1', service: 's', idempotencyKey: 'w1' }
  const a = await withdrawals.createWithdrawal(args)
  const b = await withdrawals.createWithdrawal(args)
  assert.equal(b.replay, true)
  assert.equal(a.transaction.id, b.transaction.id)
  assert.equal(await balanceOf(user.id), '600.0000')
})

test('account withdrawal: cashdesk reports the amount (Summa), request stays Pending for payout', async (t) => {
  const user = await createUser()
  t.mock.method(providers.mobcash, 'withdrawFromAccount', async () => ({ outcome: 'success', data: { Success: true, Summa: 2500 } }))
  const result = await withdrawals.createWithdrawal({ user, mode: 'account', betId: user.betId, withdrawalCode: '1234', momoNumber: '97000000', service: 'mtn' })
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(result.transaction.amount, '2500.0000')
  assert.equal(result.transaction.paymentConfirmation, 'Successful')
  assert.equal(result.outcome, 'pending-incomplete')
})

test('account withdrawal rejected by the cashdesk => Failed', async (t) => {
  const user = await createUser()
  t.mock.method(providers.mobcash, 'withdrawFromAccount', async () => ({ outcome: 'rejected', messageId: 1 }))
  const result = await withdrawals.createWithdrawal({ user, mode: 'account', betId: user.betId, withdrawalCode: 'bad', momoNumber: '1', service: 's' })
  assert.equal(result.outcome, 'failed')
  assert.equal(result.transaction.status, 'Failed')
})

test('account withdrawal with an UNKNOWN cashdesk outcome stays Pending and is flagged (never auto-failed)', async (t) => {
  const user = await createUser()
  t.mock.method(providers.mobcash, 'withdrawFromAccount', async () => ({ outcome: 'unknown', error: 'timeout' }))
  const result = await withdrawals.createWithdrawal({ user, mode: 'account', betId: user.betId, withdrawalCode: '9', momoNumber: '1', service: 's' })
  assert.equal(result.transaction.status, 'Pending')
  assert.equal(result.transaction.metadata.cashdesk.outcome, 'unknown')
})

test('withdrawals switched off => 405', async () => {
  const user = await createUser()
  await models.PlatformSettings.update({ isWithdrawalsOpen: false }, { where: { id: 1 } })
  await assert.rejects(withdrawals.createWithdrawal({ user, mode: 'wallet', amount: '10', betId: 'b', momoNumber: '1', service: 's' }), (e) => e.status === 405)
})

// --------------------------------------------------------------- transfers
test('transfer: both wallets, both history rows and both ledger entries change together', async () => {
  const alice = await createUser({ fullname: 'Alice A' })
  const bob = await createUser({ fullname: 'Bob B' })
  await fund(alice.id, '1000')
  const result = await transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '250.50' })
  assert.equal(await balanceOf(alice.id), '749.5000')
  assert.equal(await balanceOf(bob.id), '250.5000')
  assert.equal(result.transaction.fundingType, 'send')
  const rows = await models.Transaction.findAll({ where: { reference: result.transaction.reference } })
  assert.deepEqual(rows.map((r) => r.fundingType).sort(), ['receive', 'send'])
  await assertLedgerReconciles()
})

test('transfer amount validation rejects zero, negative and malformed values (the old API accepted negatives)', () => {
  for (const bad of [0, -50, '-50', 'abc', '', null, undefined, '10.999', '1e5']) {
    assert.throws(() => parseAmount(bad), (e) => e.status === 400, `should reject ${bad}`)
  }
  assert.equal(parseAmount('10.5'), '10.5')
  assert.equal(parseAmount(100), '100')
})

test('transfer to yourself is refused', async () => {
  const alice = await createUser()
  await fund(alice.id, '100')
  await assert.rejects(transfers.sendMoney({ sender: alice, recipientId: alice.id, amount: '10' }), (e) => e.status === 400)
  assert.equal(await balanceOf(alice.id), '100.0000')
})

test('transfer with insufficient funds => 506, recipient is NOT credited', async () => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '50')
  await assert.rejects(transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '50.01' }), (e) => e.status === 506)
  assert.equal(await balanceOf(bob.id), '0.0000')
  assert.equal(await models.Transaction.count(), 0)
})

test('ROLLBACK: if crediting the recipient fails after the sender was debited, everything is undone', async (t) => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '500')
  t.mock.method(wallet, 'credit', async () => { throw new Error('simulated failure while crediting recipient') })
  await assert.rejects(transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '100' }), /simulated failure/)
  t.mock.restoreAll()
  assert.equal(await balanceOf(alice.id), '500.0000')
  assert.equal(await balanceOf(bob.id), '0.0000')
  assert.equal(await models.Transaction.count(), 0)
  assert.equal(await models.LedgerEntry.count({ where: { userId: alice.id } }), 1) // only the funding entry
})

test('CONCURRENCY: 20 simultaneous transfers of 10 from a balance of 100 => exactly 10 succeed', async () => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '100')
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '10' })))
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 10)
  assert.equal(await balanceOf(alice.id), '0.0000')
  assert.equal(await balanceOf(bob.id), '100.0000')
  await assertLedgerReconciles()
})

test('CONCURRENCY: opposite transfers (A->B and B->A, 25 each) never deadlock and money is conserved', async () => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '1000')
  await fund(bob.id, '1000')
  const jobs = []
  for (let i = 0; i < 25; i += 1) {
    jobs.push(transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '7' }))
    jobs.push(transfers.sendMoney({ sender: bob, recipientId: alice.id, amount: '3' }))
  }
  const results = await Promise.allSettled(jobs)
  assert.ok(results.every((r) => r.status === 'fulfilled'), results.filter((r) => r.status === 'rejected').map((r) => r.reason.message).join('; '))
  assert.equal(await balanceOf(alice.id), String((1000 - 25 * 7 + 25 * 3).toFixed(4)))
  assert.equal(await balanceOf(bob.id), String((1000 + 25 * 7 - 25 * 3).toFixed(4)))
  await assertLedgerReconciles()
})

test('transfer is idempotent per key', async () => {
  const alice = await createUser()
  const bob = await createUser()
  await fund(alice.id, '500')
  const args = { sender: alice, recipientId: bob.id, amount: '100', idempotencyKey: 't-1' }
  const a = await transfers.sendMoney(args)
  const b = await transfers.sendMoney(args)
  assert.equal(b.replay, true)
  assert.equal(a.transaction.id, b.transaction.id)
  assert.equal(await balanceOf(bob.id), '100.0000')
})

test('a deactivated recipient cannot receive', async () => {
  const alice = await createUser()
  const bob = await createUser({ isActivated: false })
  await fund(alice.id, '100')
  await assert.rejects(transfers.sendMoney({ sender: alice, recipientId: bob.id, amount: '10' }), (e) => e.status === 502)
  assert.equal(await balanceOf(alice.id), '100.0000')
})

// -------------------------------------------------------------------- QR
test('QR: at most 20 codes per user per 24 hours', async () => {
  const user = await createUser()
  for (let i = 0; i < 20; i += 1) await qrService.generate({ user, betId: user.betId, amount: '500', service: 'mtn' })
  await assert.rejects(qrService.generate({ user, betId: user.betId, amount: '500', service: 'mtn' }), (e) => e.status === 429)
})

test('QR: validity check marks an expired code Expired', async () => {
  const user = await createUser()
  const qr = await qrService.generate({ user, betId: user.betId, amount: '500', service: 'mtn' })
  await models.QrCodeDeposit.update({ validUntil: new Date(Date.now() - 1000) }, { where: { id: qr.id } })
  assert.equal((await qrService.checkValidity(qr.id)).qrcodeStatus, 'Expired')
  assert.deepEqual(await qrService.listOpenIds(), [])
})

test('QR CONCURRENCY: two people paying the same QR at once => only one claim wins', async () => {
  const user = await createUser()
  const qr = await qrService.generate({ user, betId: user.betId, amount: '500', service: 'mtn' })
  const { qrRepository } = require('../src/repositories')
  const claims = await Promise.all(Array.from({ length: 6 }, () => models.sequelize.transaction((t) => qrRepository.claim(qr.id, t))))
  assert.equal(claims.filter(Boolean).length, 1)
})

test('QR deposit made without logging in is credited to the QR owner and the QR is single-use', async (t) => {
  const owner = await createUser()
  const qr = await qrService.generate({ user: owner, betId: owner.betId, amount: '1000', service: 'mtn' })
  const { qrRepository } = require('../src/repositories')
  assert.equal(await models.sequelize.transaction((tx) => qrRepository.claim(qr.id, tx)), true)
  t.mock.method(providers.qos, 'collect', async () => qosOk)
  t.mock.method(providers.mobcash, 'rechargeAccount', async () => cashdeskOk)
  const result = await deposits.createDeposit({
    user: owner, mode: 'qos', qr, betId: qr.betId, amount: '1000', momoNumber: '97000001', network: 'MOOV', service: 'moov', momoName: 'Payer Person'
  })
  assert.equal(result.transaction.userId, owner.id)
  assert.equal(result.transaction.authenticatedDeposit, false)
  assert.equal(result.transaction.qrCodeId, qr.id)
  assert.equal(await models.sequelize.transaction((tx) => qrRepository.claim(qr.id, tx)), false)
})
