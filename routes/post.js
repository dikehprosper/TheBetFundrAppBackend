/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable no-undef */
const {
  commentOnPost,
  getComments,
  likePost,
  getLikes,
  addToView,
  getFollowingPosts,
  getRandomPosts,
  getViews,
  getMyPosts,
  deleteComment,
  updatePost,
  deletePost,
  getMyLikedPosts,
} = require("../controllers/post.js");
const express = require("express");

// const Post = require('../models/post');

const router = express.Router();

let isRequestProcessing = false;
function checkRequestProcessing(req, res, next) {
  if (isRequestProcessing) {
    res
      .status(429)
      .send({ message: "Too many requests. Please try again later." });
  } else {
    isRequestProcessing = true;
    next();
  }
}

// get endpoints
router.get("/", getRandomPosts);
router.get("/my-posts", getMyPosts);
router.get("/liked-posts", getMyLikedPosts);
router.get("/following", getFollowingPosts);
router.get("/like", getLikes);
router.get("/comment", getComments);
router.get("/view", getViews);

// post endpoints
router.post("/like", likePost);
router.post("/comment", commentOnPost);
router.post("/view", addToView);

// delete endpoints
router.delete("/", deletePost);
router.delete("/comment", deleteComment);

// patch endpoints
router.patch("/", updatePost);

// /api/houses
router.get("/", checkRequestProcessing, (req, res) => {
  const posts = [
    {
      id: 1,
      name: "WhaleGuru",
      time: "2024-04-10T12:00:00Z",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
      profileImage:
        "https://images.unsplash.com/photo-1519289417163-b07e4859b01a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGJldHRpbmd8ZW58MHx8MHx8fDA%3D",
      text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
      likeCount: 8999,
      commentCount: 2999,
      likes: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      comments: [
        {
          id: "1",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      views: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
    },
    {
      id: 2,
      name: "WhaleGuru",
      time: "2024-04-11T12:00:00Z",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
      text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
      likeCount: 4000,
      commentCount: 80000,
      likes: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      comments: [
        {
          id: "1",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      views: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
    },
    {
      id: 3,
      name: "WhaleGuru3",
      time: "2024-04-11T12:00:00Z",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
      text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
      likeCount: 5000,
      commentCount: 2999,
      likes: [
        {
          id: "1",
          name: "john",

          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      comments: [
        {
          id: "1",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      views: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
    },
    {
      id: 4,
      name: "WhaleGuru",
      time: "2024-04-11T12:00:00Z",
      image:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
      profileImage:
        "https://images.unsplash.com/photo-1519289417163-b07e4859b01a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fGJldHRpbmd8ZW58MHx8MHx8fDA%3D",
      text: "We offer competitive odds on a variety of sports and events. Welcome Bonus for new users.Deposit match bonuses.Free bets. Aliquam lorem ante dapibus in viverra quis feugiat a tellus.",
      likeCount: 8999,
      commentCount: 2999,
      likes: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      comments: [
        {
          id: "1",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          description: "done",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
      views: [
        {
          id: "1",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "2",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
        {
          id: "3",
          name: "john",
          image:
            "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSXOtjibvD_PZPLzAtymBkRmL2H6VZQZsuUNIasn5M3sQ&s",
        },
      ],
    },
  ];

  try {
    isRequestProcessing = false; // Set flag to false when response is returned
    res.send({
      message: "successful",
      post: posts,
    });
  } catch (error) {
    isRequestProcessing = false;
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
