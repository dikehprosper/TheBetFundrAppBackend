/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// middleware.js
const multer = require("multer");

const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage: storage });

module.exports = upload;
