/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const admin = require("firebase-admin");
const serviceAccount = require("../service-account-file.json"); // Make sure to put the correct path

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://lamedcash-b5a42.appspot.com", // Your Firebase storage bucket URL
});

const bucket = admin.storage().bucket(); // Initialize the bucket

module.exports = { admin, bucket };
