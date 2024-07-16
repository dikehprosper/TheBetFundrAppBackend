const express = require("express");
const verifyToken = require("../verifyToken");
const { followUser, getFollowers } = require("../controllers/action");

const router = express.Router();

router.get("/follow", verifyToken, getFollowers);

router.put("/follow", verifyToken, followUser);

module.exports = router;
