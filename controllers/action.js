/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const User = require("../models/user");
const Post = require("../models/post");

const getFollowers = async (req, res) => {
  try {
    const user = req.user;
    const userWithFollowers = await User.findById(user._id)
      .populate(["followers", "following"])
      .lean();

    return res.status(200).json({
      success: true,
      message: "Followers and following returned",
      data: {
        followers: userWithFollowers.followers,
        following: userWithFollowers.following,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "A server error has occured",
      error: err,
    });
  }
};

const followUser = async (req, res) => {
  try {
    const userId = req.query.id;
    const user = req.user;

    const fetchedUser = await User.findById(user._id);

    if (fetchedUser.following.includes(userId)) {
      await User.findByIdAndUpdate(user._id, {
        $pull: {
          following: userId,
        },
      });
      await User.findByIdAndUpdate(userId, { $pull: { followers: user._id } });

      return res
        .status(200)
        .json({ success: true, message: "Unfollowed user" });
    } else {
      await User.findByIdAndUpdate(user._id, {
        $push: {
          following: userId,
        },
      });
      await User.findByIdAndUpdate(userId, {
        $push: {
          followers: user._id,
        },
      });

      return res.status(200).json({ success: true, message: "Followed User" });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "A server error has occurred",
      error: err,
    });
  }
};

const getUserData = async (req, res) => {
  const id = req.query.id;
  try {
    const user = await User.findById(id);
    const posts = await Post.find({ user: id });

    return res.status(200).json({
      success: false,
      message: "User Data returned",
      data: { user: { ...user._doc, postCount: posts.length } },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "A server error has occurred",
      error: err,
    });
  }
};

const updatePushToken = async (req, res) => {
  const { pushToken } = req.body;
  const user = req.user;
  try {
    await User.findByIdAndUpdate(user._id, { $set: { pushToken } });
    console.log("push token updatd");
    return res
      .status(200)
      .json({ success: true, message: "Push token updated" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({
      success: false,
      message: "A server error has occurred",
      error: err,
    });
  }
};

module.exports = { followUser, getFollowers, getUserData, updatePushToken };
