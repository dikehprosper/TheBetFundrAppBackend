/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const User = require("../models/user");

 const getFollowers = async (req, res) => {
  try {
    const user = req.user;
    const userWithFollowers = await User.findById(user._id)
      .populate(["followers", "following"])
      .exec();

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

    if (user.following.contains(userId)) {
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
module.exports = {
  followUser,
  getFollowers
  
}