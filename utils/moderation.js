/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const sharp = require('sharp');
const nsfwjs = require('nsfwjs');
const tf = require('@tensorflow/tfjs-node'); // Ensure you have this installed

let model;

// Load the NSFW model
const loadModel = async () => {
    if (!model) {
        model = await nsfwjs.load();
        console.log('NSFW model loaded');
    }
};

// Function to moderate content
const moderateContent = async (imageBuffer) => {
    await loadModel(); // Ensure the model is loaded

    // Resize the image using sharp and convert it to raw RGB format
    const { data, info } = await sharp(imageBuffer)
        .resize(224, 224) // NSFW.js expects 224x224 input
        .raw() // Get the raw pixel data
        .toBuffer({ resolveWithObject: true });

    const numChannels = 3; // RGB
    const tensor = tf.tensor3d(data, [info.height, info.width, numChannels], 'int32'); // Convert to Tensor

    // Classify the image using the NSFW model
    const predictions = await model.classify(tensor);

    // Check for NSFW content
    const nsfwThreshold = 0.7; // Set a threshold for classification
    const nsfwCategories = ['Porn', 'Hentai', 'Suggestive'];

    for (const prediction of predictions) {
        if (nsfwCategories.includes(prediction.className) && prediction.probability > nsfwThreshold) {
            throw new Error('Inappropriate content detected');
        }
    }

    return predictions; // Return predictions if needed
};

module.exports = {
    moderateContent,
};
