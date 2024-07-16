/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require("mongoose");
const {
  serverErrorResponse,
  successResponse,
  failedResponse,
} = require("../helpers/response.js");
const Post = require("../models/post.js");
const User = require("../models/user.js");
const { check } = require("express-validator");
const admin = require("firebase-admin");
const multer = require("multer");
require("dotenv").config();
admin.initializeApp(
  {
    credential: admin.credential.cert(require("../service-account-file.json")),
    storageBucket: "gs://groupchat-d6de7.appspot.com",
  },
  "post",
);

// getters

const getPostDetails = async (req, res) => {
  const postId = req.query.postId;

  try {
    const post = await Post.findById(postId)
      .populate("user")
      .populate("comments.user")
      .exec();

    return successResponse(res, "Post returned successfully", { post });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getRandomPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .limit(20)
      .sort({ createdAt: -1 })
      .populate("user")
      .populate("comments.user")
      .exec();

    return successResponse(res, "Posts returned", { posts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getFollowingPosts = async (req, res) => {
  const userId = req.query.userId;

  try {
    const user = await User.findById(userId);

    const followingPosts = await Post.find({ _id: { $in: user.following } })
      .limit(20)
      .sort({ createdAt: -1 })
      .populate("user")
      .populate("comments.user")
      .exec();

    return successResponse(res, "Following Posts returned", { followingPosts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getMyPosts = async (req, res) => {
  const userId = req.query.userId;

  try {
    const userPosts = await Post.find({ user: userId })
      .populate("user")
      .populate("comments.user")
      .exec();

    return successResponse(res, "User posts returned", { posts: userPosts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getMyLikedPosts = async (req, res) => {
  const userId = req.query.userId;

  try {
    const likedPosts = await Post.find({
      likes: { $elemMatch: { userId: userId } },
    })
      .populate("user")
      .populate("comments.user")
      .exec();

    return successResponse(res, "Liked Posts returned", { posts: likedPosts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getLikes = async (req, res) => {
  const postId = req.query.postId;

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
  const postId = req.query.postId;

  try {
    const post = await Post.findById(postId).populate("comments.user").exec();

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

// post functions
const createPost = async (req, res) => {
  const file = req.file;
  const { userId, postDetails } = req.body;
  let publicUrl;

  try {
    const existingUser = await User.findById(userId);

    if (file) {
      const webpBuffer = await sharp(file.buffer)
        .webp({ quality: 80 })
        .toBuffer();

      const bucket = admin.storage().bucket();
      const newFileName = `${existingUser._id}-${Date.now()}.webp`; // Save as .webp
      const fileUpload = bucket.file(`postImages/${newFileName}`);

      const blobStream = fileUpload.createWriteStream({
        metadata: { contentType: "image/webp" },
      });

      blobStream.on("error", (error) => {
        console.error("Error uploading file to Firebase:", error);
        transactionInProgress = false;

        return res.send({
          success: 503,
          message: "Failed to upload image",
          status: 503,
        });
      });

      blobStream.on("finish", async () => {
        await fileUpload.makePublic();
        publicUrl = `https://storage.googleapis.com/${
          bucket.name
        }/postImages/${encodeURIComponent(newFileName)}`;
      });
    }

    const createdPost = await Post.create({
      user: existingUser.id,
      ...postDetails,
      image: publicUrl,
    });

    return successResponse(res, "Post created successfully", { createdPost });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const deletePost = async (req, res) => {
  const { postId, userId } = req.body;

  try {
    const deletedPost = await Post.findOneAndDelete({
      _id: postId,
      user: userId,
    });

    return successResponse(res, "Post deleted");
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

export const getSavedPost = async (req, res) => {
  try {
    const user = req.user;
    const userWithSavedPosts = await User.findById(user._id)
      .populate("savedPosts")
      .exec();

    return res
      .status(200)
      .json({
        success: true,
        message: "Saved posts returned",
        data: { savedPosts: userWithSavedPosts.savedPosts },
      });
  } catch (err) {
    return res
      .status(500)
      .json({
        success: false,
        message: "A server error has occured",
        error: err,
      });
  }
};

export const savePost = async (req, res) => {
  const user = req.user;
  const postId = req.query.postId;
  try {
    await User.findByIdAndUpdate(user._id, { $push: { savedPosts: postId } });
    return res.status(200).json({ success: true, message: "Saved Post" });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "A server error has occured",
      error: err,
    });
  }
};

const updatePost = async (req, res) => {
  const { postId, postUpdate } = req.body;
  try {
    const updatedPost = await Post.findByIdAndUpdate(postId, {
      $set: { ...postUpdate },
    });

    return successResponse(res, "Post updated successfully", { updatedPost });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

// like functions
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

// comment functions
const commentOnPost = async (req, res) => {
  const { postId, userId, comment } = req.body;

  try {
    const user = await User.findById(userId);

    const newId = new mongoose.mongo.ObjectId();

    const commentDetails = {
      id: newId,
      user: userId,
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

const deleteComment = async (req, res) => {
  const { commentId, postId } = req.body;

  try {
    const updatedPost = await Post.findByIdAndUpdate(postId, {
      $pull: { comments: { id: commentId } },
    });

    return successResponse(res, "Comment deleted successfully", {
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
  deletePost,
  addToView,
  commentOnPost,
  deleteComment,
  getRandomPosts,
  getFollowingPosts,
  updatePost,
  getMyPosts,
  getMyLikedPosts,
  createPost,
  getPostDetails,
};
