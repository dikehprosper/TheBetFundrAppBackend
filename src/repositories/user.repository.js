const { Op } = require('sequelize')
const { sequelize, Sequelize, User } = require('../models')

const byLowerEmail = (email) => Sequelize.where(Sequelize.fn('lower', Sequelize.col('email')), String(email).trim().toLowerCase())

const findByEmail = (email, options = {}) => User.findOne({ where: byLowerEmail(email), ...options })
const findById = (id, options = {}) => User.findByPk(id, options)
const findByTag = (tag, options = {}) =>
  User.findOne({ where: Sequelize.where(Sequelize.fn('lower', Sequelize.col('tag')), String(tag).toLowerCase()), ...options })
const findManyByIds = (ids) => User.findAll({ where: { id: { [Op.in]: ids } } })
const create = (attrs, options = {}) => User.create(attrs, options)
const updateById = async (id, attrs, options = {}) => {
  const [count, rows] = await User.update(attrs, { where: { id }, returning: true, ...options })
  return count ? rows[0] : null
}
const listReferrals = (referrerId) => User.findAll({ where: { referrerId }, order: [['registeredAt', 'ASC']] })

/** Row-lock a set of users in a fixed order (by id) so concurrent transfers can never deadlock. */
async function lockUsers (ids, transaction) {
  const sorted = [...new Set(ids)].sort()
  return sequelize.query('SELECT id FROM users WHERE id IN (:ids) ORDER BY id FOR UPDATE', {
    replacements: { ids: sorted },
    type: sequelize.QueryTypes.SELECT,
    transaction
  })
}

/** Users matching a tag or name fragment (for the "send to" search). */
const searchPublic = (query, excludeId, limit = 20) => {
  const q = `%${String(query).replace(/[%_\\]/g, '\\$&')}%`
  return User.findAll({
    where: {
      id: { [Op.ne]: excludeId },
      isActivated: true,
      role: 'user',
      [Op.or]: [{ tag: { [Op.iLike]: q } }, { fullname: { [Op.iLike]: q } }]
    },
    attributes: ['id', 'fullname', 'tag', 'image'],
    limit
  })
}

const countByTagPrefix = (prefix) =>
  User.count({ where: { tag: { [Op.iLike]: `${String(prefix).replace(/[%_\\]/g, '\\$&')}%` } } })

module.exports = {
  byLowerEmail, findByEmail, findById, findByTag, findManyByIds, create, updateById,
  listReferrals, lockUsers, searchPublic, countByTagPrefix
}
