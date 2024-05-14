/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  // id: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String },
  createdAt: { type: Date, default: Date() },
  image: { type: String },
  profileImage: { type: String },
  likeCount: { type: Number },
  viewCount: { type: Number },
  commentCount: { type: Number },
  likes: {
    type: [
      {
        id: { type: String, required: true },
        userEmail: { type: String },
        name: { type: String },
        image: { type: String },
      },
    ],
  },
  comments: {
    type: [
      {
        id: { type: String, required: true },
        userEmail: { type: String },
        name: { type: String },
        description: { type: String },
        image: { type: String },
      },
    ],
  },
  views: {
    type: [
      {
        id: { type: String, required: true },
        userEmail: { type: String },
        name: { type: String },
        image: { type: String },
      },
    ],
  },
});

module.exports = mongoose.model("Post", PostSchema);
