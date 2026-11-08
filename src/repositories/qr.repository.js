const { Op } = require('sequelize')
const { sequelize, QrCodeDeposit } = require('../models')

const create = (attrs, options = {}) => QrCodeDeposit.create(attrs, options)
const findById = (id, options = {}) => QrCodeDeposit.findByPk(id, options)
const countSince = (userId, since) => QrCodeDeposit.count({ where: { userId, createdAt: { [Op.gte]: since } } })
const listOpen = () =>
  QrCodeDeposit.findAll({ where: { used: false, qrcodeStatus: 'Pending' }, attributes: ['id'], order: [['createdAt', 'ASC']] })
const markExpired = (id) => QrCodeDeposit.update({ qrcodeStatus: 'Expired' }, { where: { id } })

/** Atomically take a QR code for payment. Two simultaneous payers can never both get it. */
async function claim (id, transaction) {
  const rows = await sequelize.query(
    `UPDATE qr_code_deposits
        SET used = TRUE, updated_at = now()
      WHERE id = :id AND used = FALSE AND qrcode_status = 'Pending' AND valid_until > now()
      RETURNING id`,
    { replacements: { id }, type: sequelize.QueryTypes.SELECT, transaction }
  )
  return rows.length === 1
}

const release = (id, transaction) =>
  QrCodeDeposit.update({ used: false }, { where: { id, paymentConfirmation: { [Op.ne]: 'Successful' } }, transaction })
const setConfirmation = (id, paymentConfirmation, transaction) =>
  QrCodeDeposit.update({ paymentConfirmation }, { where: { id }, transaction })

module.exports = { create, findById, countSince, listOpen, markExpired, claim, release, setConfirmation }
