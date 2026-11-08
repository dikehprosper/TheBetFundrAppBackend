const bcrypt = require('bcryptjs')
const { sequelize, Follow, AccountDeletionRequest, Post } = require('../models')
const { userRepository } = require('../repositories')
const providers = require('./providers')
const { prepareImage, assertImageAllowed } = require('./image.service')
const { sendTemplate } = require('../utils/helpers/mail.helper')
const { createSocialNotification } = require('./notification.service')
const { toPublicProfile } = require('../utils/helpers/dto.helper')
const { AppError } = require('../utils/handlers')

async function changeProfileImage (user, file) {
  if (!file) throw new AppError(400, 'An image is required')
  const buffer = await prepareImage(file.buffer, { width: 512, height: 512, fit: 'cover' })
  await assertImageAllowed(buffer)
  const saved = await providers.storage.save({ buffer, originalName: 'profile.webp', contentType: 'image/webp', folder: 'profiles' })
  const previous = user.imageFileName
  const updated = await userRepository.updateById(user.id, { image: saved.url, imageFileName: saved.fileName })
  if (previous) await providers.storage.remove(previous)
  return updated
}

async function changeDetails (user, { fullname, number, betId }) {
  const changes = {}
  if (fullname !== undefined) changes.fullname = fullname
  if (number !== undefined) changes.phoneNumber = String(number)
  if (betId !== undefined) changes.betId = String(betId)
  return userRepository.updateById(user.id, changes)
}

async function setTag (user, tag) {
  const taken = await userRepository.findByTag(tag)
  if (taken && taken.id !== user.id) throw new AppError(409, 'This tag is already taken', { code: 409 })
  try {
    return await userRepository.updateById(user.id, { tag })
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw new AppError(409, 'This tag is already taken', { code: 409 })
    throw error
  }
}

const changeColorScheme = (user, colorScheme) => userRepository.updateById(user.id, { colorScheme })
const updatePushToken = (user, expoPushToken) => userRepository.updateById(user.id, { expoPushToken })

/** People this user referred. Name and sign-up progress only, never email addresses. */
async function referrals (user) {
  const rows = await userRepository.listReferrals(user.id)
  return rows.map((r) => ({ _id: r.id, fullname: r.fullname, tag: r.tag, status: r.pinState ? 'Completed' : 'Pending', registrationDateTime: r.registeredAt }))
}

async function requestAccountDeletion (user, password) {
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new AppError(503, 'Invalid password')
  await sequelize.transaction(async (t) => {
    await userRepository.updateById(user.id, { deleteRequestState: true, isActivated: false, sessionId: null, isLoggedIn: false }, { transaction: t })
    await AccountDeletionRequest.create({ userId: user.id, email: user.email }, { transaction: t })
  })
  await sendTemplate('ACCOUNT_DELETION_REQUESTED', user.email, { fullname: user.fullname })
}

async function toggleFollow (user, targetId) {
  if (user.id === targetId) throw new AppError(400, 'You cannot follow yourself')
  const target = await userRepository.findById(targetId)
  if (!target || !target.isActivated) throw new AppError(404, 'User not found')
  const existing = await Follow.findOne({ where: { followerId: user.id, followingId: targetId } })
  if (existing) {
    await existing.destroy()
    return { following: false }
  }
  await Follow.create({ followerId: user.id, followingId: targetId })
  createSocialNotification({ fromUserId: user.id, toUserId: targetId, type: 'follow', description: `${user.fullname} started following you` }).catch(() => {})
  return { following: true }
}

async function followLists (userId) {
  const user = await userRepository.findById(userId, {
    include: [{ association: 'followers', attributes: ['id', 'fullname', 'tag', 'image'], through: { attributes: [] } },
      { association: 'following', attributes: ['id', 'fullname', 'tag', 'image'], through: { attributes: [] } }]
  })
  if (!user) throw new AppError(404, 'User not found')
  return { followers: user.followers.map(toPublicProfile), following: user.following.map(toPublicProfile) }
}

/** Public profile with counts (no balances, emails or hashes). */
async function publicProfile (userId, viewerId) {
  const user = await userRepository.findById(userId)
  if (!user || !user.isActivated) throw new AppError(404, 'User not found')
  const [followers, following, posts, followedByViewer] = await Promise.all([
    Follow.count({ where: { followingId: userId } }),
    Follow.count({ where: { followerId: userId } }),
    Post.count({ where: { userId } }),
    viewerId ? Follow.count({ where: { followerId: viewerId, followingId: userId } }) : 0
  ])
  return { ...toPublicProfile(user), followerCount: followers, followingCount: following, postCount: posts, isFollowing: followedByViewer > 0 }
}

const searchUsers = async (user, query) => (await userRepository.searchPublic(query, user.id)).map(toPublicProfile)

module.exports = {
  changeProfileImage, changeDetails, setTag, changeColorScheme, updatePushToken, referrals,
  requestAccountDeletion, toggleFollow, followLists, publicProfile, searchUsers
}
