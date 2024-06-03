/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */

const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  // id: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  image: { type: String },
  profileImage: { type: String },
  likeCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  likes: [
    {
      userId: { type: String, required: true },
      userEmail: { type: String },
      name: { type: String },
      image: { type: String },
    },
  ],
  comments: {
    type: [
      {
        id: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
