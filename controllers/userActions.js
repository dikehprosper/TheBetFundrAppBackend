const User = require("../models/user.js")
const { successResponse, serverErrorResponse, failedResponse } = require("../helpers/response.js")

const getFollowers = async (req, res) => {
  const userId = req.query.userId

  try {
    const user = await User.findById(userId)

    return successResponse(res, "Followers and following returned", { followers: user.followers, following: user.following })
  } catch (err) {
    return serverErrorResponse(res, err)
  }
}

const followUser = async (req, res) => {
  const { userId, targetId } = req.body
  try {
    const user = await User.findById(userId)

    if (user.following.includes(targetId)) {
      const unfollowedTarget = await User.findByIdAndUpdate(userId, {
        $pull: {
          following: targetId
        }
      })
      const target = await User.findByIdAndUpdate(targetId, {
        $pull: {
          followers: userId
        }
      })

      return successResponse(res, "Unfollowed User")
    } else {
      const followedTarget = await User.findByIdAndUpdate(userId, {
        $push: {
          following: targetId
        }
      })
      const target = await User.findByIdAndUpdate(targetId, {
        $push: {
          followers: userId
        }
      })

      return successResponse(res, "Followed User")
    }
  } catch (err) {
    return serverErrorResponse(res, err)
  }
}

const createTag = async (req, res) => {
  const { userId, tag } = req.body
  try {
    const existingUser = await User.findById(userId)

    if (!existingUser) return failedResponse(res, "User does not exist")

    if (existingUser.tag) return failedResponse(res, "User already has a tag")

    const updatedUser = await User.findByIdAndUpdate(userId, {
      $set: {
        tag: tag
      }
    })

    return successResponse(res, "Tag uploaded successfully", { updatedUser })
  } catch (err) {
    return serverErrorResponse(res, err)
  }
}

module.exports = { createTag, getFollowers, followUser }
