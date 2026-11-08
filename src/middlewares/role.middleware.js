const { AppError } = require('../utils/handlers')

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, 'You are not allowed to do this', { code: 403 }))
  return next()
}

module.exports = { requireAdmin: requireRole('admin'), requireRole }
