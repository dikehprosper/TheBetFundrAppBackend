const { sequelize, PlatformSettings } = require('../models')

const get = async (options = {}) => {
  const [row] = await PlatformSettings.findOrCreate({ where: { id: 1 }, defaults: { id: 1 }, ...options })
  return row
}

const setFlags = async (flags, options = {}) => {
  await get(options)
  await PlatformSettings.update(flags, { where: { id: 1 }, ...options })
  return get(options)
}

/** Atomic counter bump (no read-modify-write). */
const addDisbursedBonus = (amount, transaction) =>
  sequelize.query(
    'UPDATE platform_settings SET disbursed_bonus_balance = disbursed_bonus_balance + :amount::numeric, updated_at = now() WHERE id = 1',
    { replacements: { amount }, transaction }
  )

module.exports = { get, setFlags, addDisbursedBonus }
