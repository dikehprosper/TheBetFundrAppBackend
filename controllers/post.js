import mongoose from "mongoose";
import {
  serverErrorResponse,
  successResponse,
  failedResponse,
} from "../helpers/response.js";
import Post from "../models/post.js";
import User from "../models/user.js";

export const getLikes = async (req, res) => {
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

export const getComments = async (req, res) => {
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

export const likePost = async (req, res) => {
  const { postId, userId } = req.body;

  try {
    const user = await User.findById(userId);
    const post = await Post.findById(postId);

    const likeDetails = { id: userId, name: user.fullname, image: user.image };

    const updatedPost = await Post.findByIdAndUpdate(postId, {
      $push: { likes: likeDetails },
    });

    return successResponse(res, "Post has been liked", { updatedPost });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};

export const commentOnPost = async (req, res) => {
  const { postId, userId, comment } = req.body;

  try {
    const user = await User.findById(userId);

    const commentDetails = {
      id: userId,
      name: user.fullname,
      image: user.image,
      description: comment,
    };

    const updatedPost = await Post.findByIdAndUpdate(postId, {
      $push: { comments: commentDetails },
    });

    return successResponse(res, "Commented on post successfully", {
      updatedPost,
    });
  } catch (err) {
    return serverErrorResponse(res, err);
  }
};
