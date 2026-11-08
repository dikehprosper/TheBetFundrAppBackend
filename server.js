require('dotenv').config()
const http = require('node:http')
const logger = require('./src/config/logger.config')
const { connectDatabase, sequelize } = require('./src/config/database.config')
const { createApp, allowedOrigins } = require('./src/app')
const socket = require('./src/config/socket.config')

const REQUIRED = ['ACCESS_TOKEN_PRIVATE_KEY']

async function start () {
  const missing = REQUIRED.filter((name) => !process.env[name])
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  if (!process.env.DATABASE_URL && !process.env.DB_NAME) throw new Error('Set DATABASE_URL or the DB_* variables')

  await connectDatabase()
  const server = http.createServer(createApp())
  socket.init(server, allowedOrigins())

  const port = Number(process.env.PORT || 5001)
  server.listen(port, () => logger.info(`API listening on port ${port}`))

  const shutdown = (signal) => {
    logger.info({ signal }, 'shutting down')
    server.close(async () => {
      await sequelize.close()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch((error) => {
  logger.fatal({ err: error }, 'failed to start')
  process.exit(1)
})
