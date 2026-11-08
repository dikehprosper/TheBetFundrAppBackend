const logger = require('../config/logger.config')

/**
 * Error carrying both an HTTP status and the legacy numeric `success` code the
 * mobile client switches on. The two are equal for every code the old API used.
 */
class AppError extends Error {
  constructor (status, message, { code = status, details, extra } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.extra = extra // merged into the top level of the response body (legacy shape)
  }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

function notFoundHandler (_req, res) {
  res.status(404).json({ success: 404, message: 'Route not found' })
}

// eslint-disable-next-line no-unused-vars
function errorHandler (error, req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ success: error.code, message: error.message, status: error.code, ...(error.extra || {}), ...(error.details ? { details: error.details } : {}) })
  }
  if (error && error.type === 'entity.parse.failed') {
    return res.status(400).json({ success: 400, message: 'Malformed JSON body' })
  }
  if (error && error.name === 'MulterError') {
    return res.status(400).json({ success: 400, message: error.message })
  }
  if (error && error.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ success: 409, message: 'Conflict: resource already exists' })
  }
  // Anything else is a bug or an outage: log the detail, never return it.
  logger.error({ err: error, path: req.path, method: req.method }, 'unhandled error')
  return res.status(500).json({ success: 500, message: 'Something went wrong. Please try again.' })
}

module.exports = { AppError, asyncHandler, notFoundHandler, errorHandler }
