const { Notification } = require('../models')
const { userRepository } = require('../repositories')
const providers = require('./providers')
const { emitToUser } = require('../config/socket.config')

/** Realtime + push for a money event. Best effort: never throws, never part of the money path. */
async function notifyMoneyEvent (userId, { title, body, data = {} }) {
  try {
    emitToUser(userId, 'transaction', { title, body, ...data })
    const user = await userRepository.findById(userId, { attributes: ['id', 'expoPushToken'] })
    if (user && user.expoPushToken) await providers.push.send(user.expoPushToken, { title, body, data })
  } catch (_error) {
    // swallowed on purpose
  }
}

/** In-app notification row (likes, comments, follows) plus a push. */
async function createSocialNotification ({ fromUserId, toUserId, type, description, postId = null }) {
  if (fromUserId === toUserId) return null
  const notification = await Notification.create({ fromUserId, toUserId, type, description, postId })
  const user = await userRepository.findById(toUserId, { attributes: ['id', 'expoPushToken'] })
  if (user && user.expoPushToken) providers.push.send(user.expoPushToken, { title: type, body: description, data: { postId } })
  emitToUser(toUserId, 'notification', { id: notification.id, type, description, postId })
  return notification
}

module.exports = { notifyMoneyEvent, createSocialNotification }
