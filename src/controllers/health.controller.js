const { sequelize } = require('../models')

/** Liveness plus a real database round-trip, so a deploy can tell "up" from "up but cannot reach the database". */
async function health (_req, res) {
  try {
    await sequelize.query('SELECT 1')
    res.status(200).json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) })
  } catch (_error) {
    res.status(503).json({ status: 'degraded', database: 'down' })
  }
}

module.exports = { health }
