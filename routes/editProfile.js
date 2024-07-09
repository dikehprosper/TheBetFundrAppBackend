/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const sharp = require("sharp");
const admin = require("firebase-admin");
const { check } = require("express-validator");
const multer = require("multer");
const VerifyMobileNumber = require("../utils/verifyPhone");
require("dotenv").config();
const upload = multer({ storage: multer.memoryStorage() });
admin.initializeApp({
  credential: admin.credential.cert(require("../service-account-file.json")),
  storageBucket: "gs://groupchat-d6de7.appspot.com",
});

const signInValidate = [
  check("fullname")
    .isLength({ min: 2 })
    .withMessage("Your full name is required"),
  check("email").isEmail().withMessage("Please provide a valid email"),
];

let transactionInProgress = false;
// Middleware function to check if a transaction is in progress
const checkOngoingTransaction = (req, res, next) => {
  // Check if a transaction is already in progress
  if (transactionInProgress) {
    return res
      .status(400)
      .json({ error: "Another transaction is already in progress" });
  }
  // If no transaction is in progress, allow the route handler to proceed
  next();
};

router.post(
  "/editProfileImage",
  checkOngoingTransaction,
  upload.single("image"),
  async (req, res) => {
    try {
      console.log("done")
      transactionInProgress = true;
      const { email } = req.body;
      const file = req.file;

      if (!file) {
        transactionInProgress = false;
        return res.send({
          success: 400,
          message: "No image uploaded",
          status: 400,
        });
      }

      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        transactionInProgress = false;
        return res.send({
          success: 401,
          message: "User not found",
          status: 401,
        });
      }

      if (!existingUser.isActivated) {
        transactionInProgress = false;
        return res.send({
          success: 502,
          message: "User is deactivated",
          status: 502,
        });
      }

      // Convert image to WebP format with sharp
      const webpBuffer = await sharp(file.buffer)
        .webp({ quality: 80 })
        .toBuffer();

      const bucket = admin.storage().bucket();
      const newFileName = `${existingUser._id}-${Date.now()}.webp`; // Save as .webp
      const fileUpload = bucket.file(`profileImages/${newFileName}`); // Organize files in a subfolder

      // Delete old image if it exists
      if (existingUser.imageFileName) {
        try {
          await bucket
            .file(`profileImages/${existingUser.imageFileName}`)
            .delete();
        } catch (err) {
          transactionInProgress = false;
          return res.send({
            success: 501,
            message: "unable to delete previous file",
            status: 501,
          });
        }
      }

      const blobStream = fileUpload.createWriteStream({
        metadata: { contentType: "image/webp" },
      });

      blobStream.on("error", (error) => {
        console.error("Error uploading file to Firebase:", error);
        transactionInProgress = false;

        return res.send({
          success: 503,
          message: "Failed to upload image",
          status: 503,
        });
      });

      blobStream.on("finish", async () => {
        await fileUpload.makePublic();
        const publicUrl = `https://storage.googleapis.com/${
          bucket.name
        }/profileImages/${encodeURIComponent(newFileName)}`;

        existingUser.image = publicUrl;
        existingUser.imageFileName = newFileName;
        await existingUser.save();
        transactionInProgress = false;
        res.send({
          success: true,
          message: "Profile image updated successfully",
          image: publicUrl,
        });
      });
      transactionInProgress = false;
      blobStream.end(webpBuffer);
    } catch (error) {
      transactionInProgress = false;
      console.error("Error updating user profile:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

router.post(
  "/changeUserDetails",
  checkOngoingTransaction,
  signInValidate,
  async (req, res) => {
    try {
      transactionInProgress = true;
      const { fullname, email, number, fedapayId, betId } = req.body;
      const numberPrefix = number.substring(0, 2);
      const network = VerifyMobileNumber({ numberPrefix });
      console.log(network);

      if (network.length < 1) {
        transactionInProgress = false;
        return res.send({
          success: 400,
          message: "invalid number",
          status: 400,
        });
      }

      // Check if the User  exists
      const user = await User.findOne({ email });
      if (!user.isActivated) {
        transactionInProgress = false;
        return res.send({
          success: 502,
          message: "User is deactivated",
          status: 502,
        });
      }

      if (user.isUser === true) {
        const apiUrl = `${process.env.APIURL1}${fedapayId}`;
        const apiKey = process.env.FEDAPAY_KEY1;
        console.log(apiUrl);
        const response = await fetch(apiUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            firstname: fullname.split(" ")[0],
            lastname: fullname.split(" ")[1],
            email: email,
            phone_number: {
              number: `+229${number}`,
              country: "BJ",
            },
          }),
        });
        console.log(response.status);
        if (response.status === 200) {
          user.fullname = fullname;
          user.email = email;
          user.number = number;
          user.betId = betId;
          await user.save();
          // Return the updated information
          transactionInProgress = false;
          return res
            .status(201)
            .send({
              success: true,
              message: "updated information successfully",
              status: 210,
              user,
            });
        }
        if (response.status !== 200) {
          transactionInProgress = false;
          return res
            .status(402)
            .send({
              success: 402,
              message: "failed to update information on fedapay",
              status: 402,
            });
        }
      }
    } catch (error) {
      transactionInProgress = false;
      console.error("Error updating user:", error);
      return res
        .status(500)
        .send({ success: false, message: "Internal server error" });
    }
  }
);

module.exports = router;

// const storage = multer.memoryStorage();
// const fileFilter = (req, file, cb) => {
//     const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'text/plain'];
//     if (!allowedTypes.includes(file.mimetype)) {
//         cb(new Error('Unsupported file type'), false);
//     } else {
//         cb(null, true);
//     }
// };
// const upload = multer({ storage, fileFilter });

// router.post('/uploadContent', upload.single('file'), async (req, res) => {
//     try {
//         const { email, description } = req.body;  // Assuming description for text content
//         const file = req.file;

//         if (!file) {
//             return res.status(400).send({ success: false, message: 'No file provided' });
//         }

//         const existingUser = await User.findOne({ email });
//         if (!existingUser) {
//             return res.status(404).send({ success: false, message: 'User not found' });
//         }

//         let fileBuffer = file.buffer;
//         if (file.mimetype.startsWith('image/') && file.mimetype !== 'image/webp') {
//             // Convert image to WebP format if it's not already WebP
//             fileBuffer = await sharp(file.buffer)
//                 .webp({ quality: 80 })
//                 .toBuffer();
//         }

//         const newFileName = `${existingUser._id}-${Date.now()}.${file.mimetype.split('/')[1]}`;
//         const fileUpload = admin.storage().bucket().file(newFileName);

//         const blobStream = fileUpload.createWriteStream({
//             metadata: { contentType: file.mimetype }
//         });

//         blobStream.on('error', error => {
//             console.error('Error uploading file:', error);
//             return res.status(500).json({ error: 'Failed to upload file' });
//         });

//         blobStream.on('finish', async () => {
//             await fileUpload.makePublic();
//             const publicUrl = `https://storage.googleapis.com/${admin.storage().bucket().name}/${encodeURIComponent(newFileName)}`;

//             res.send({ success: true, message: "Content uploaded successfully", url: publicUrl });
//         });

//         blobStream.end(fileBuffer);
//     } catch (error) {
//         console.error('Error uploading content:', error);
//         res.status(500).json({ error: 'Internal server error' });
//     }
// });
