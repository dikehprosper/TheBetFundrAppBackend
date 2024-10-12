/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
require('dotenv').config(); // Load environment variables from .env file
const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
const sharp = require('sharp');

// Create a Rekognition client using custom environment variables
const rekognition = new RekognitionClient({
    region: process.env.AWS_SES_REGION, // Use your custom region variable
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY, // Use your custom access key variable
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY // Use your custom secret key variable
    }
});

// Function to moderate content
const moderateContent = async (imageBuffer) => {
    const params = {
        Image: {
            Bytes: imageBuffer,
        },
        MinConfidence: 75, // Set minimum confidence level for moderation
    };

    const command = new DetectModerationLabelsCommand(params);

    try {
        const result = await rekognition.send(command);
        const labels = result.ModerationLabels;

        // Check for inappropriate content
        if (labels.length > 0) {
            throw new Error('Inappropriate content detected');
        }

        return labels; // Return labels if needed
    } catch (error) {
        console.error("Error in moderation:", error);
        throw new Error('Moderation error occurred');
    }
};

// Function to handle image processing and moderation
// Function to handle image processing and moderation
const processImage = async (imageBuffer) => {
    // Resize the image using sharp
    const resizedImageBuffer = await sharp(imageBuffer)
        .resize(224, 224) // Resize image for standardization
        .toBuffer();

    // Moderate the content using AWS Rekognition
    const labels = await moderateContent(resizedImageBuffer);
    console.log('Moderation Labels:', labels);
    return resizedImageBuffer; // Return the resized image buffer for uploading
};

module.exports = {
    moderateContent,
    processImage, // Export the processImage function for handling image processing
};
