const path = require('node:path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const hpp = require('hpp')
const pino = require('pino-http')
const logger = require('./config/logger.config')
const { errorHandler, notFoundHandler } = require('./utils/handlers')
const { verifyToken } = require('./middlewares/access.middleware')
const { apiLimiter } = require('./middlewares/rateLimit.middleware')

function allowedOrigins () {
  const raw = process.env.CORS_ORIGINS || '*'
  return raw === '*' ? '*' : raw.split(',').map((o) => o.trim()).filter(Boolean)
}

/** Builds the Express app without listening, so tests can drive it over real HTTP. */
function createApp () {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: allowedOrigins(), exposedHeaders: ['auth-token'] }))
  app.use(pino({ logger, autoLogging: process.env.NODE_ENV !== 'test' }))
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use(hpp())
  app.use(apiLimiter)

  if ((process.env.STORAGE_DRIVER || 'local') === 'local') {
    app.use('/uploads', express.static(path.resolve(process.env.STORAGE_LOCAL_DIR || 'uploads'), { fallthrough: true, index: false }))
  }

  app.use('/health', require('./routes/health.route'))
  app.use('/api/usersWithoutToken', require('./routes/auth.route'))
  app.use('/api/fixtures', require('./routes/fixture.route'))

  // everything below needs a valid token
  app.use('/api/posts', verifyToken, require('./routes/post.route'))
  app.use('/api/users/actions', verifyToken, require('./routes/action.route'))
  app.use('/api/users', verifyToken, require('./routes/user.route'))
  app.use('/api/predictions', verifyToken, require('./routes/prediction.route'))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

module.exports = { createApp, allowedOrigins }
