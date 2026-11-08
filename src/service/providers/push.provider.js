const logger = require('../../config/logger.config')

let expo = null
function client () {
  if (!expo) {
    const { Expo } = require('expo-server-sdk')
    expo = { Expo, instance: new Expo() }
  }
  return expo
}

/** Best-effort push notification. Never throws: a failed push must not fail a payment. */
async function send (expoPushToken, { title, body, data = {} }) {
  if (!expoPushToken || process.env.EXPO_PUSH_DISABLED === 'true' || process.env.NODE_ENV === 'test') return false
  try {
    const { Expo, instance } = client()
    if (!Expo.isExpoPushToken(expoPushToken)) return false
    await instance.sendPushNotificationsAsync([{ to: expoPushToken, sound: 'default', title, body, data }])
    return true
  } catch (error) {
    logger.warn({ err: error }, 'push notification failed')
    return false
  }
}

module.exports = { send }
