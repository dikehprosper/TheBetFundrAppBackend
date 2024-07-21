const express = require("express");
const verifyToken = require("../verifyToken");
const {
  followUser,
  getFollowers,
  getUserData,
} = require("../controllers/action");

const router = express.Router();

router.get("/follow", getFollowers);
router.get("/data", getUserData);

router.put("/follow", followUser);

module.exports = router;
