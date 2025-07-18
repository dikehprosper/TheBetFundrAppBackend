/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unused-vars */
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
const Comment = require("../models/comment.js");
const Notification = require("../models/notification.js");
const { check } = require("express-validator");
const multer = require("multer");
const sharp = require("sharp");
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
const { sendNotification } = require("../helpers/notification");
const { admin, bucket } = require("../routes/firebase.js")


// // middleware.js
// const multer = require("multer");

// const storage = multer.memoryStorage(); // Store files in memory
// const upload = multer({ storage: storage });

// module.exports = upload;



const { processImage } = require('../utils/moderation.js');

const getPostDetails = async (req, res) => {
  const postId = req.query.postId;

  try {
    const post = await Post.findById(postId)
      .populate("user")
      .populate("views")
      .lean();

    return successResponse(res, "Post returned successfully", { post });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getRandomPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user")
      .populate("views")
      .lean();

    return successResponse(res, "Posts returned", { posts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getFollowingPosts = async (req, res) => {
  const user = req.user;

  try {
    const userData = await User.findById(user._id);

    const followingPosts = await Post.find({
      user: { $in: userData.following },
    })
      .sort({ createdAt: -1 })
      .populate("user")
      .populate("views")
      .lean();

    return successResponse(res, "Following Posts returned", {
      posts: followingPosts,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getMyPosts = async (req, res) => {
  const userId = req.query.userId;

  try {
    const userPosts = await Post.find({ user: userId })
      .populate("user")
      .populate("views")
      .lean();

    return successResponse(res, "User posts returned", { posts: userPosts });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getMyLikedPosts = async (req, res) => {
  const userId = req.query.userId;

  try {
    const likedPosts = await Post.find({
      likes: userId,
    })
      .populate("user")
      .populate("views")
      .lean();

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

const getMyComments = async (req, res) => {
  const user = req.user;
  try {
    const myComments = await Comment.find({ user: user._id })
      .populate("user")
      .populate("post")
      .populate({ path: "post", populate: { path: "user" } })
      .populate({ path: "post", populate: { path: "views" } })
      .lean();

    return successResponse(res, "My comments returned", {
      comments: myComments,
    });
  } catch (err) {}
};

const getComments = async (req, res) => {
  const postId = req.query.postId;
  try {
    const comments = await Comment.find({ post: postId })
      .populate("user")
      .lean();

    return successResponse(res, "Comments returned", {
      comments,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getViews = async (req, res) => {
  const { postId } = req.body;

  try {
    const post = await Post.findById(postId).populate("views");

    if (!post) return failedResponse(res, "Post not found");

    return successResponse(res, "Views returned", { views: post.views });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};



const createPost = async (req, res) => {
  const files = req.files; // Array of files
  const { body } = req.body;
  const user = req.user;
  let publicUrls = []; // Array to store URLs of uploaded files

  try {
    const existingUser = await User.findById(user._id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Function to upload a file
    const uploadFile = async (file) => {
      const bucket = admin.storage().bucket();
      const newFileName = `${existingUser._id}-${Date.now()}-${file.originalname}`;
      const fileUpload = bucket.file(`postMedia/${newFileName}`);

      let buffer;
      let contentType;

      // Handle different file types
      if (file.mimetype.startsWith("image")) {
        // Process the image (resize and moderate)
        buffer = await processImage(file.buffer);
        contentType = "image/webp"; // Set content type after processing
      } else if (file.mimetype.startsWith("video")) {
        buffer = file.buffer; // Keep the original buffer for videos
        contentType = file.mimetype;
      } else {
        throw new Error("Unsupported file type");
      }

      const blobStream = fileUpload.createWriteStream({
        metadata: { contentType },
      });

      return new Promise((resolve, reject) => {
        blobStream.on("error", (error) => {
          console.error("Error uploading file to Firebase:", error);
          reject(new Error("Failed to upload file"));
        });

        blobStream.on("finish", async () => {
          await fileUpload.makePublic();
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/postMedia/${encodeURIComponent(newFileName)}`;
          resolve({
            url: publicUrl,
            type: file.mimetype.startsWith("image") ? "image" : "video",
          });
        });

        blobStream.end(buffer);
      });
    };

    // Loop through each file and upload it
    if (files && files.length > 0) {
      for (const file of files) {
        const publicUrl = await uploadFile(file);
        publicUrls.push(publicUrl);
      }
    }

    // Create a single post with multiple media files
    const createdPost = await Post.create({
      user: existingUser._id,
      body,
      media: publicUrls,
    });

    return res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: createdPost,
    });
  } catch (err) {
    console.error("Error creating post:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the post",
      error: err.message,
    });
  }
};


const deletePost = async (req, res) => {
  const { postId } = req.query;
  const user = req.user;

  try {
    const deletedPost = await Post.findOneAndDelete({
      _id: postId,
      user: user._id,
    });
    await Comment.deleteMany({ post: postId });

    return successResponse(res, "Post deleted");
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const getSavedPost = async (req, res) => {
  try {
    const user = req.user;
    const savedPosts = await Post.find({ saves: user._id }).populate("user");

    return res.status(200).json({
      success: true,
      message: "Saved posts returned",
      data: { savedPosts },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "A server error has occured",
      error: err,
    });
  }
};




const savePost = async (req, res) => {
  const user = req.user;
  const postId = req.query.postId;
  try {
    const post = await Post.findById(postId);
    if (post.saves.includes(user._id)) {
      await Post.findByIdAndUpdate(postId, { $pull: { saves: user._id } });
      await User.findByIdAndUpdate(user._id, { $pull: { savedPosts: postId } });

      return res.status(200).json({ success: true, message: "Unsaved Post" });
    } else {
      await Post.findByIdAndUpdate(postId, { $push: { saves: user._id } });
      await User.findByIdAndUpdate(user._id, { $push: { savedPosts: postId } });
      return res.status(200).json({ success: true, message: "Saved Post" });
    }
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
  const { postId } = req.body;

  try {
    const user = req.user;
    const post = await Post.findById(postId).populate("user").exec();

    if (post.likes.includes(user._id)) {
      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $pull: { likes: user._id },
        $inc: { likeCount: -1 },
      });

      return successResponse(res, "Post has been unliked", { updatedPost });
    } else {
      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $push: { likes: user._id },
        $inc: { likeCount: 1 },
      });

      if (user._id !== post.user._id) {
        // send notification to user
        const notification = await Notification.create({
          from: user._id,
          to: post.user._id,
          description: `${user.fullname} has liked your post`,
          type: "like",
          post: post._id,
        });

        const from = await User.findById(user._id);
        const to = await User.findById(notification.to);

        await sendNotification(
          to,
          from,
          "like",
          notification.description,
          notification.createdAt
        );
      }

      return successResponse(res, "Post has been liked", { updatedPost });
    }
  } catch (err) {
    console.log(err);
    return serverErrorResponse(res, err);
  }
};

// comment functions
const commentOnPost = async (req, res) => {
  const { postId, comment } = req.body;
  const user = req.user;

  try {
    const commentCreated = await Comment.create({
      user: user._id,
      post: postId,
      description: comment,
    });

    const post = await Post.findByIdAndUpdate(postId, {
      $inc: { commentCount: 1 },
    }).populate("user");

    if (user._id !== post.user._id) {
      // send notification to user
      const notification = await Notification.create({
        from: user._id,
        to: post.user._id,
        description: `${user.fullname} commented on your post`,
        type: "comment",
        post: post._id,
      });

      const from = await User.findById(user._id);
      const to = await User.findById(notification.to);

      await sendNotification(
        to,
        from,
        "comment",
        notification.description,
        notification.createdAt
      );
    }
    return successResponse(res, "Commented on post successfully", {
      comment: commentCreated,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const editComment = async (req, res) => {
  const commentId = req.query.commentId;
  const { description } = req.body;
  try {
    await Comment.findByIdAndUpdate(commentId, { $set: { description } });
    return successResponse(res, "Comment edited", {});
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const deleteComment = async (req, res) => {
  const commentId = req.query.commentId;
  const postId = req.query.postId;

  try {
    await Comment.findByIdAndDelete(commentId);
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: -1 } });
    return successResponse(res, "Comment deleted successfully", {});
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

const addToView = async (req, res) => {
  const { postId } = req.body;
  const user = req.user;

  try {
    const post = await Post.findById(postId);
    if (!post.views.includes(user._id)) {
      const updatedPost = await Post.findByIdAndUpdate(postId, {
        $push: { views: user._id },
        $inc: { viewCount: 1 },
      });
    }
    return successResponse(res, "Viewed post");
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
  getSavedPost,
  savePost,
  getMyComments,
  editComment,
};
