/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  user: { type: String, required: true },
  name: { type: String },
  body: { type: String, },
  createdAt: { type: Date, default: Date.now },
  media: [
    {
      url: { type: String },
      type: { type: String, enum: ['image', 'video'] }
    }
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
      userId: { type: String, required: true },
      user: { type: String, },
      userEmail: { type: String },
      name: { type: String },
      description: { type: String },
      image: { type: String },
    },
  ],
  views: [
    {
      userId: { type: String, required: true },
      userEmail: { type: String },
      name: { type: String },
      image: { type: String },
    },
  ],
});

module.exports = mongoose.model("Post", PostSchema);
