const { AppError } = require('../utils/handlers')

/** Turn a route off from the environment, e.g. FEATURE_DEPOSITS=false. On unless set to "false". */
const featureFlag = (name) => (_req, _res, next) => {
  if (String(process.env[`FEATURE_${name}`]).toLowerCase() === 'false') return next(new AppError(503, 'This feature is currently unavailable'))
  return next()
}

module.exports = { featureFlag }
