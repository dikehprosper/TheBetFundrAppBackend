const express = require("express");
const verifyToken = require("../verifyToken");
const { followUser, getFollowers } = require("../controllers/action");

const router = express.Router();

router.get("/follow", getFollowers);

router.put("/follow", followUser);

module.exports = router;
