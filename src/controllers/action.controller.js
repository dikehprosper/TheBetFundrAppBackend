const userService = require('../service/user.service')
const { asyncHandler } = require('../utils/handlers')

const followUser = asyncHandler(async (req, res) => res.status(200).json({ success: true, ...(await userService.toggleFollow(req.user, req.body.userId)) }))
const getFollowers = asyncHandler(async (req, res) => res.status(200).json(await userService.followLists(req.query.userId || req.user.id)))
const getUserData = asyncHandler(async (req, res) => res.status(200).json(await userService.publicProfile(req.query.userId || req.user.id, req.user.id)))
const updatePushToken = asyncHandler(async (req, res) => {
  await userService.updatePushToken(req.user, req.body.expoPushToken)
  res.status(200).json({ success: true, message: 'Push token updated' })
})

module.exports = { followUser, getFollowers, getUserData, updatePushToken }
