/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  body: { type: String },
  createdAt: { type: Date, default: Date.now },
  media: [
    {
      url: { type: String },
      type: { type: String, enum: ["image", "video"] },
    },
  ],
  likeCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  saves: [{type: mongoose.Schema.Types.ObjectId, ref: "User"}],
  likes: [
    {
      userId: { type: String, required: true },
      userEmail: { type: String },
      name: { type: String },
      image: { type: String },
    },
  ],
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
