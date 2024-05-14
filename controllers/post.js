const mongoose = require("mongoose");
const {
  serverErrorResponse,
  successResponse,
  failedResponse,
} = require("../helpers/response.js");
const Post = require("../models/post.js");
const User = require("../models/user.js");

// return posts

const getRandomPosts = async (req, res) => {
  try {
    const posts = await Post.find().limit(20).sort({ createdAt: -1 });

    return successResponse(res, "Posts returned", { posts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getFollowingPosts = async (req, res) => {
  const { userId } = req.body;

  try {
    const user = await User.findById(userId);

    const followingPosts = await Post.find({ _id: { $in: user.following } })
      .limit(20)
      .sort({ createdAt: -1 });

    return successResponse(res, "Following Posts returned", { followingPosts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

// post actions
const getLikes = async (req, res) => {
  const { postId } = req.body;

  try {
    const post = await Post.findById(postId);

    if (!post) return failedResponse(res, "Post not found");

    return successResponse(res, "Likes returned", {
      likes: post.likes,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getComments = async (req, res) => {
  const { postId } = req.body;

  try {
    const post = await Post.findById(postId);

    if (!post) return failedResponse(res, "Post not found");

    return successResponse(res, "Comments returned", {
      comments: post.comments,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getViews = async (req, res) => {
  const { postId } = req.body;

  try {
    const post = await Post.findById(postId);

    if (!post) return failedResponse(res, "Post not found");

    return successResponse(res, "Views returned", { views: post.views });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const createPost = async (req, res) => {
  const imageFile = req.file;
};

const likePost = async (req, res) => {
  const { postId, userId } = req.body;

  try {
    const user = await User.findById(userId);
    const post = await Post.findById(postId);

    const likeDetails = {
      id: userId,
      userEmail: user.email,
      name: user.fullname,
      image: user.image,
    };

    if (post.likes.filter((item) => item.id === userId).length) {
      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $pop: { likes: likeDetails },
        $dec: { likeCount: 1 },
      });

      return successResponse(res, "Post has been unliked", { updatedPost });
    } else {
      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $push: { likes: likeDetails },
        $inc: { likeCount: 1 },
      });

      return successResponse(res, "Post has been liked", { updatedPost });
    }
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const commentOnPost = async (req, res) => {
  const { postId, userId, comment } = req.body;

  try {
    const user = await User.findById(userId);

    const commentDetails = {
      id: userId,
      userEmail: user.email,
      name: user.fullname,
      image: user.image,
      description: comment,
    };

    const updatedPost = await Post.findByIdAndUpdate(postId, {
      $push: { comments: commentDetails },
      $inc: { commentCount: 1 },
    });

    return successResponse(res, "Commented on post successfully", {
      updatedPost,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const addToView = async (req, res) => {
  const { postId, userId } = req.body;

  try {
    const user = await User.findById(userId);
    // const post = await Post.findById(postId);

    const viewDetails = {
      id: userId,
      name: user.fullname,
      email: user.email,
      image: user.image,
    };

    const updatedPost = await Post.findByIdAndUpdate(id, {
      $push: { views: viewDetails },
      $inc: { viewCount: 1 },
    });

    return successResponse(res, "Viewed post", { updatedPost });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

module.exports = {
  getLikes,
  getComments,
  getViews,
  likePost,
  addToView,
  commentOnPost,
  getRandomPosts,
  getFollowingPosts,
};
