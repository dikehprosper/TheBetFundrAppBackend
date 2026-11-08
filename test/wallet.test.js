const { test, before, after, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const { models, setupDatabase, resetDatabase, createUser, balanceOf, closeDatabase } = require('./helpers')
const wallet = require('../src/service/wallet.service')

before(setupDatabase)
beforeEach(resetDatabase)
after(closeDatabase)

const fund = (userId, amount) =>
  wallet.runInTransaction((t) => wallet.credit(userId, amount, 'adjustment', null, t))

test('credit then debit keeps exact decimal balance and writes ledger rows', async () => {
  const user = await createUser()
  await fund(user.id, '100.10')
  await wallet.runInTransaction((t) => wallet.debit(user.id, '0.0100', 'transfer_out', null, t))
  assert.equal(await balanceOf(user.id), '100.0900')
  const entries = await models.LedgerEntry.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] })
  assert.deepEqual(entries.map((e) => e.amount), ['100.1000', '-0.0100'])
  assert.deepEqual(entries.map((e) => e.balanceAfter), ['100.1000', '100.0900'])
})

test('overdraft is rejected with code 506 and changes nothing', async () => {
  const user = await createUser()
  await fund(user.id, '50')
  await assert.rejects(
    wallet.runInTransaction((t) => wallet.debit(user.id, '50.0001', 'transfer_out', null, t)),
    (error) => error.status === 506
  )
  assert.equal(await balanceOf(user.id), '50.0000')
  assert.equal(await models.LedgerEntry.count({ where: { userId: user.id } }), 1)
})

test('CONCURRENCY: 25 simultaneous debits of 10 against a balance of 100 => exactly 10 succeed', async () => {
  const user = await createUser()
  await fund(user.id, '100')
  const results = await Promise.allSettled(
    Array.from({ length: 25 }, () => wallet.runInTransaction((t) => wallet.debit(user.id, '10', 'transfer_out', null, t)))
  )
  const ok = results.filter((r) => r.status === 'fulfilled').length
  const rejected = results.filter((r) => r.status === 'rejected')
  assert.equal(ok, 10)
  assert.equal(rejected.length, 15)
  assert.ok(rejected.every((r) => r.reason.status === 506))
  assert.equal(await balanceOf(user.id), '0.0000')
  // ledger reconciles with the balance
  const [{ sum }] = await models.sequelize.query('SELECT SUM(amount)::text AS sum FROM ledger_entries WHERE user_id = :id', {
    replacements: { id: user.id }, type: models.sequelize.QueryTypes.SELECT
  })
  assert.equal(sum, '0.0000')
})

test('ROLLBACK: an error after a debit restores the balance and leaves no ledger row', async () => {
  const user = await createUser()
  await fund(user.id, '80')
  await assert.rejects(
    wallet.runInTransaction(async (t) => {
      await wallet.debit(user.id, '30', 'transfer_out', null, t)
      throw new Error('boom after debit')
    }),
    /boom after debit/
  )
  assert.equal(await balanceOf(user.id), '80.0000')
  assert.equal(await models.LedgerEntry.count({ where: { userId: user.id } }), 1)
})

test('the database itself refuses a negative balance, even if application code is bypassed', async () => {
  const user = await createUser()
  await assert.rejects(
    models.sequelize.query('UPDATE users SET bonus_balance = -1 WHERE id = :id', { replacements: { id: user.id } }),
    /check constraint|violates/i
  )
})

test('ledger is append-only: UPDATE and DELETE are blocked', async () => {
  const user = await createUser()
  await fund(user.id, '10')
  await assert.rejects(models.sequelize.query('UPDATE ledger_entries SET amount = 99'), /append-only/)
  await assert.rejects(models.sequelize.query('DELETE FROM ledger_entries'), /append-only/)
})

test('rejects malformed amounts before touching the database', async () => {
  const user = await createUser()
  for (const bad of ['-5', '0', 'abc', '', '1e3', 10]) {
    await assert.rejects(wallet.runInTransaction((t) => wallet.credit(user.id, bad, 'adjustment', null, t)), /positive decimal strings/)
  }
})

test('splitAgainstBalance divides an amount into wallet and cash parts', async () => {
  const user = await createUser({ bonusBalance: '300' })
  await wallet.runInTransaction(async (t) => {
    assert.deepEqual(await wallet.splitAgainstBalance(user.id, '1000', t), { walletPart: '300.0000', cashPart: '700.0000', balance: '300.0000' })
    assert.deepEqual(await wallet.splitAgainstBalance(user.id, '200', t), { walletPart: '200.0000', cashPart: '0.0000', balance: '300.0000' })
  })
})

test('referral bonus is amount x 0.0099, exactly', async () => {
  assert.equal(await wallet.referralBonusFor('1000', '0.0099'), '9.9000')
  assert.equal(await wallet.referralBonusFor('12345', '0.0099'), '122.2155')
})
