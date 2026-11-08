const { Sequelize } = require('sequelize')
const logger = require('./logger.config')

function resolveUrl () {
  if (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL
  return process.env.DATABASE_URL
}

function buildSequelize () {
  const url = resolveUrl()
  const common = {
    dialect: 'postgres',
    logging: false,
    pool: { max: Number(process.env.DB_POOL_MAX || 20), min: 0, idle: 10000, acquire: 30000 },
    dialectOptions: process.env.DB_SSL === 'true' ? { ssl: { require: true, rejectUnauthorized: false } } : {},
    define: { underscored: true, timestamps: true },
    // Isolation is chosen per operation (see wallet.service); the default stays READ COMMITTED.
    isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  }
  if (url) return new Sequelize(url, common)
  return new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
    ...common,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432)
  })
}

const sequelize = buildSequelize()

async function connectDatabase () {
  await sequelize.authenticate()
  logger.info('PostgreSQL connection established')
}

module.exports = { sequelize, connectDatabase, Sequelize }
