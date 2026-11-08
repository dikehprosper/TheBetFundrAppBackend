/**
 * Minimal, dependency-free SQL migration runner.
 *
 *   node scripts/migrate.js up       apply every pending migration
 *   node scripts/migrate.js down     revert the most recent migration
 *   node scripts/migrate.js status   list applied / pending migrations
 *
 * Files live in /migrations as NNN_name.up.sql and NNN_name.down.sql.
 * Each file runs inside its own transaction, so a failure leaves nothing half-applied.
 * Applied versions are recorded in the schema_migrations table.
 */
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')
require('dotenv').config()

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations')

module.exports = { runMigrations, rollbackLast, migrationStatus, connectionConfig }

function connectionConfig (url = process.env.DATABASE_URL) {
  if (url) {
    return {
      connectionString: url,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    }
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  }
}

function listMigrations () {
  const files = fs.readdirSync(MIGRATIONS_DIR)
  const versions = new Map()
  for (const file of files) {
    const match = file.match(/^(\d+_[a-z0-9_]+)\.(up|down)\.sql$/)
    if (!match) continue
    const entry = versions.get(match[1]) || { version: match[1] }
    entry[match[2]] = path.join(MIGRATIONS_DIR, file)
    versions.set(match[1], entry)
  }
  return [...versions.values()].sort((a, b) => a.version.localeCompare(b.version))
}

async function ensureTable (client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`)
}

async function applied (client) {
  const { rows } = await client.query('SELECT version FROM schema_migrations ORDER BY version')
  return new Set(rows.map((row) => row.version))
}

async function withClient (config, fn) {
  const client = new Client(config)
  await client.connect()
  try {
    // serialise concurrent deploys
    await client.query('SELECT pg_advisory_lock(727274)')
    await ensureTable(client)
    return await fn(client)
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {})
    await client.end()
  }
}

async function runMigrations (config = connectionConfig(), log = () => {}) {
  return withClient(config, async (client) => {
    const done = await applied(client)
    const ran = []
    for (const migration of listMigrations()) {
      if (done.has(migration.version)) continue
      if (!migration.up) throw new Error(`Missing up file for ${migration.version}`)
      log(`applying ${migration.version}`)
      await client.query('BEGIN')
      try {
        await client.query(fs.readFileSync(migration.up, 'utf8'))
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version])
        await client.query('COMMIT')
        ran.push(migration.version)
      } catch (error) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${migration.version} failed: ${error.message}`)
      }
    }
    return ran
  })
}

async function rollbackLast (config = connectionConfig(), log = () => {}) {
  return withClient(config, async (client) => {
    const done = [...(await applied(client))].sort()
    const last = done[done.length - 1]
    if (!last) return null
    const migration = listMigrations().find((m) => m.version === last)
    if (!migration || !migration.down) throw new Error(`Missing down file for ${last}`)
    log(`reverting ${last}`)
    await client.query('BEGIN')
    try {
      await client.query(fs.readFileSync(migration.down, 'utf8'))
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [last])
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`Rollback of ${last} failed: ${error.message}`)
    }
    return last
  })
}

async function migrationStatus (config = connectionConfig()) {
  return withClient(config, async (client) => {
    const done = await applied(client)
    return listMigrations().map((m) => ({ version: m.version, applied: done.has(m.version) }))
  })
}

if (require.main === module) {
  const command = process.argv[2] || 'status'
  const log = (message) => console.log(message)
  const run = {
    up: () => runMigrations(connectionConfig(), log).then((ran) => log(ran.length ? `applied ${ran.length} migration(s)` : 'nothing to apply')),
    down: () => rollbackLast(connectionConfig(), log).then((v) => log(v ? `reverted ${v}` : 'nothing to revert')),
    status: () => migrationStatus().then((rows) => rows.forEach((r) => log(`${r.applied ? '[x]' : '[ ]'} ${r.version}`)))
  }[command]
  if (!run) {
    console.error('usage: node scripts/migrate.js [up|down|status]')
    process.exit(1)
  }
  run().catch((error) => { console.error(error.message); process.exit(1) })
}
