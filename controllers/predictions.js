/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const mongoose = require("mongoose");
const {
    serverErrorResponse,
    successResponse,
    failedResponse,
} = require("../helpers/response.js");

const { League, Team } = require("../models/prediction.js");
const User = require("../models/user.js");
const Comment = require("../models/comment.js");
const Notification = require("../models/notification.js");
const { check } = require("express-validator");
const multer = require("multer");
const sharp = require("sharp");
const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();
const { sendNotification } = require("../helpers/notification");
const { admin, bucket } = require("../routes/firebase.js")


// // middleware.js
// const multer = require("multer");

// const storage = multer.memoryStorage(); // Store files in memory
// const upload = multer({ storage: storage });

// module.exports = upload;



const { processImage } = require('../utils/moderation.js');


// Middleware for handling both files and form data
const upload = multer({ dest: 'uploads/' });




const createLeague = async (req, res) => {
    console.log("Received request to create league");

    // The uploaded file will be available in req.file (for single file upload) or req.files (for multiple files)
    const file = req.file; // For a single file upload
    const body = req.body; // Other form data
    const user = req.user; // User data from middleware (if you're using authentication)

    console.log(file, body, "Received file and form data");

    let publicUrls = []; // Array to store URLs of uploaded files (if multiple files are uploaded)

    if (file) {
        // Perform any required operations on the file (e.g., save to cloud storage, generate public URLs)
        publicUrls.push(file.path); // If stored locally, you can use the file path
    }

    // try {

    //     // Function to upload a file
    //     const uploadFile = async (file) => {
    //         const bucket = admin.storage().bucket();
    //         const newFileName = `${existingUser._id}-${Date.now()}-${file.originalname}`;
    //         const fileUpload = bucket.file(`postMedia/${newFileName}`);

    //         let buffer;
    //         let contentType;

    //         // Handle different file types
    //         if (file.mimetype.startsWith("image")) {
    //             // Process the image (resize and moderate)
    //             buffer = await processImage(file.buffer);
    //             contentType = "image/webp"; // Set content type after processing
    //         } else if (file.mimetype.startsWith("video")) {
    //             buffer = file.buffer; // Keep the original buffer for videos
    //             contentType = file.mimetype;
    //         } else {
    //             throw new Error("Unsupported file type");
    //         }

    //         const blobStream = fileUpload.createWriteStream({
    //             metadata: { contentType },
    //         });

    //         return new Promise((resolve, reject) => {
    //             blobStream.on("error", (error) => {
    //                 console.error("Error uploading file to Firebase:", error);
    //                 reject(new Error("Failed to upload file"));
    //             });

    //             blobStream.on("finish", async () => {
    //                 await fileUpload.makePublic();
    //                 const publicUrl = `https://storage.googleapis.com/${bucket.name}/postMedia/${encodeURIComponent(newFileName)}`;
    //                 resolve({
    //                     url: publicUrl,
    //                     type: file.mimetype.startsWith("image") ? "image" : "video",
    //                 });
    //             });

    //             blobStream.end(buffer);
    //         });
    //     };

    //     // Loop through each file and upload it
    //     if (files && files.length > 0) {
    //         for (const file of files) {
    //             const publicUrl = await uploadFile(file);
    //             publicUrls.push(publicUrl);
    //         }
    //     }

    //     // Create a single post with multiple media files
    //     const createdLeague = await League.create({
    //         league: existingUser._id,
    //         image: publicUrls,
    //     });

    //     return res.status(201).json({
    //         success: true,
    //         message: "Post created successfully",
    //         data: createdPost,
    //     });
    // } catch (err) {
    //     console.error("Error creating post:", err);
    //     return res.status(500).json({
    //         success: false,
    //         message: "An error occurred while creating the post",
    //         error: err.message,
    //     });
    // }
};

module.exports = {
    createLeague,
};
