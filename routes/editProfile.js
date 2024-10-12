/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const sharp = require("sharp");
const { check } = require("express-validator");
const multer = require("multer");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const VerifyMobileNumber = require("../utils/verifyPhone");
require("dotenv").config();
const upload = multer({ storage: multer.memoryStorage() });

const { admin, bucket } = require("./firebase");


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
  upload.single("image"), // Upload image middleware
  async (req, res) => {
    try {
     
      transactionInProgress = true;
      const { email } = req.body;
      const file = req.file;

      if (!file) {
        transactionInProgress = false;
        return res.status(400).send({
          success: false,
          message: "No image uploaded",
          status: 400,
        });
      }

      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        transactionInProgress = false;
        return res.status(401).send({
          success: false,
          message: "User not found",
          status: 401,
        });
      }

      if (!existingUser.isActivated) {
        transactionInProgress = false;
        return res.status(502).send({
          success: false,
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
      const fileUpload = bucket.file(`profileImages/${newFileName}`);
      
      // Organize files in a subfolder
     


      // Delete old image if it exists
      if (existingUser.imageFileName !== "") {
        bucket
          .file(`profileImages/${existingUser.imageFileName}`)
          .delete()
          .then(() => {
            console.log("Previous image deleted successfully");
          })
          .catch((err) => {
            console.error("Error deleting previous image:", err);
            // Log the error but do not stop the process
          });
      }

      console.log("done")

      const blobStream = fileUpload.createWriteStream({
        metadata: { contentType: "image/webp" },
      });

      blobStream.on("error", (error) => {
        console.error("Error uploading file to Firebase:", error);
        transactionInProgress = false;

        return res.status(503).send({
          success: false,
          message: "Failed to upload image",
          status: 503,
        });
      });

      blobStream.on("finish", async () => {
        await fileUpload.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name
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

      blobStream.end(webpBuffer); // End stream here after blob is done
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
      const { fullname, email, number, betId } = req.body;
     
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
