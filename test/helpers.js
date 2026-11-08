// Test harness. Real PostgreSQL, no mocks for the database.
process.env.NODE_ENV = 'test'
process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://betfundr:betfundr_dev_pw@127.0.0.1:5432/betfundr_test'
process.env.ACCESS_TOKEN_PRIVATE_KEY = process.env.ACCESS_TOKEN_PRIVATE_KEY || 'test-secret-key-for-tests-only'
process.env.ACCESS_TOKEN_EXPIRATION = '1h'
process.env.MAIL_DISABLED = 'true'
process.env.STORAGE_DRIVER = 'local'
process.env.STORAGE_LOCAL_DIR = require('node:path').join(require('node:os').tmpdir(), 'betfundr-test-uploads')
process.env.QOS_COLLECTION_WAIT_MS = '50'
process.env.QOS_POLL_INTERVAL_MS = '10'
process.env.ENFORCE_SINGLE_SESSION = 'true'

const bcrypt = require('bcryptjs')
const { runMigrations, connectionConfig } = require('../scripts/migrate')
const models = require('../src/models')

let migrated = false
async function setupDatabase () {
  if (!migrated) {
    await runMigrations(connectionConfig(process.env.TEST_DATABASE_URL))
    migrated = true
  }
  await resetDatabase()
}

/** Empty every table (ledger triggers block UPDATE/DELETE but not TRUNCATE) and restore the settings row. */
async function resetDatabase () {
  const [tables] = await models.sequelize.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'"
  )
  const list = tables.map((t) => `"${t.tablename}"`).join(', ')
  await models.sequelize.query(`TRUNCATE ${list} RESTART IDENTITY CASCADE`)
  await models.sequelize.query('INSERT INTO platform_settings (id) VALUES (1)')
}

let counter = 0
async function createUser (overrides = {}) {
  counter += 1
  return models.User.create({
    fullname: `Test User ${counter}`,
    email: `user${counter}-${Date.now()}@example.com`,
    passwordHash: await bcrypt.hash('Password1!', 4),
    pinHash: await bcrypt.hash('12345', 4),
    pinState: true,
    betId: `10000${counter}`,
    phoneNumber: '97000000',
    tag: `lamedcash-test${counter}`,
    ...overrides
  })
}

const balanceOf = async (userId) => (await models.User.findByPk(userId)).bonusBalance
const closeDatabase = () => models.sequelize.close()

module.exports = { models, setupDatabase, resetDatabase, createUser, balanceOf, closeDatabase }

// ---------------------------------------------------------------- HTTP harness
const http = require('node:http')
let server = null
let baseUrl = null

async function startServer () {
  if (server) return baseUrl
  const { createApp } = require('../src/app')
  server = http.createServer(createApp())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
  return baseUrl
}

async function stopServer () {
  if (!server) return
  await new Promise((resolve) => server.close(resolve))
  server = null
}

/** Sign a user in the way the API does: new session + token. */
async function tokenFor (user) {
  const authService = require('../src/service/auth.service')
  const fresh = await authService.startSession(user)
  return authService.issueToken(fresh)
}

async function api (path, { method = 'GET', token, body, headers = {}, form } = {}) {
  const init = { method, headers: { ...headers } }
  if (token) init.headers.Authorization = `Bearer ${token}`
  if (form) init.body = form
  else if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body) }
  const response = await fetch(baseUrl + path, init)
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch (_e) { /* not json */ }
  return { status: response.status, body: json, text, headers: response.headers }
}

module.exports.startServer = startServer
module.exports.stopServer = stopServer
module.exports.tokenFor = tokenFor
module.exports.api = api
