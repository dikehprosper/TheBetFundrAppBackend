/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const express = require("express");
const verifyToken = require("../verifyToken");
const {
  followUser,
  getFollowers,
  getUserData,
  updatePushToken,
} = require("../controllers/action");

const router = express.Router();

router.get("/follow", getFollowers);
router.get("/data", getUserData);

router.patch("/token", updatePushToken);
router.put("/follow", followUser);

module.exports = router;
