/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  media: [
    {
      url: { type: String, required: true },
      type: { type: String, required: true }, // e.g., 'image' or 'video'
    },
  ],
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
  comments: [
    {
      id: { type: String, required: true },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      userEmail: { type: String },
      name: { type: String },
      description: { type: String },
      image: { type: String },
    },
  ],
  views: [
    {
      id: { type: String, required: true },
      userEmail: { type: String },
      name: { type: String },
      image: { type: String },
    },
  ],
});

module.exports = mongoose.model("Post", PostSchema);
