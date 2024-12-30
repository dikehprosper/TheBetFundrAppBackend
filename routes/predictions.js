/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable @typescript-eslint/no-var-requires */
// /* eslint-disable no-undef */
const {
    createLeague,
} = require("../controllers/predictions");
const express = require("express");
const multer = require("multer");
const path = require("path");
const { PredictionLeague, PredictionTeam, MatchPrediction, SecondMatchPrediction } = require("../models/prediction.js");
// const Post = require('../models/post');
const User = require("../models/user");
const router = express.Router();
const { admin, bucket } = require("./firebase");
const sharp = require("sharp");
let isRequestProcessing = false;
const app = express();

// Set up multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // Store images in the 'uploads' directory
    },
    filename: (req, file, cb) => {
        // Set the filename to be the current timestamp + original file name
        cb(null, Date.now() + path.extname(file.originalname)); // Use the file's original extension
    },
});

const upload = multer({ storage: storage }); // Use multer with defined storage settings

function checkRequestProcessing(req, res, next) {
    if (isRequestProcessing) {
        res
            .status(429)
            .send({ message: "Too many requests. Please try again later." });
    } else {
        isRequestProcessing = true;
        next();
    }
}
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

// get endpoints
// router.get("/", getRandomPosts);

// // post endpoints
// router.post("/createLeague", createLeague);
// // router.post("/like", likePost);
let transactionInProgress = false;









// Route to create a league
router.post("/createLeague", upload.single("image"), async (req, res) => {
    try {
        const { email, league } = req.body; // Get email and league name from the request body
        const file = req.file; // Get the uploaded file

        if (file) {
            // Assuming you already have a user validation mechanism (you can customize it)
            const existingUser = await User.findOne({ email });
            if (!existingUser) {
                return res.status(401).json({ success: false, message: "User not found" });
            }

            // Convert the image to WebP format with sharp (optional step)
            const webpBuffer = await sharp(file.path)
                .webp({ quality: 80 })
                .toBuffer();

            // Write the WebP buffer back to the file
            const webpFileName = `${Date.now()}.webp`;
            const webpFilePath = path.join("uploads", webpFileName);

            await sharp(file.path)
                .webp({ quality: 80 })
                .toFile(webpFilePath);

            // Delete the original file after conversion (optional)
            fs.unlinkSync(file.path); // Delete the original file if you want to save only the WebP version
            console.log(webpFilePath, "webpFilePath")
            // Create a new League document and save the image file path to the database
            const newLeague = new PredictionLeague({
                league: league,
                image: webpFilePath, // Save the path to the WebP image
            });

            await newLeague.save();

            // Send the response back with success and the new league
            const allLeagues = await PredictionLeague.find();
            res.send({
                success: true,
                message: "League added successfully",
                leagues: allLeagues,
            });
        } else {

            // Assuming you already have a user validation mechanism (you can customize it)
            const existingUser = await User.findOne({ email });
            if (!existingUser) {
                return res.status(401).json({ success: false, message: "User not found" });
            }


            const newLeague = new PredictionLeague({
                league: league,
                image: "", // Save the path to the WebP image
            });

            await newLeague.save();

            // Send the response back with success and the new league
            const allLeagues = await PredictionLeague.find();
            res.send({
                success: true,
                message: "League added successfully",
                leagues: allLeagues,
            });

        }





    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

// Route to create a league
router.post("/createTeam", upload.single("image"), async (req, res) => {
    try {
        const { email, team } = req.body; // Get email and league name from the request body
        const file = req.file; // Get the uploaded file

        if (file) {
            // Assuming you already have a user validation mechanism (you can customize it)
            const existingUser = await User.findOne({ email });
            if (!existingUser) {
                return res.status(401).json({ success: false, message: "User not found" });
            }

            // Convert the image to WebP format with sharp (optional step)
            const webpBuffer = await sharp(file.path)
                .webp({ quality: 80 })
                .toBuffer();

            // Write the WebP buffer back to the file
            const webpFileName = `${Date.now()}.webp`;
            const webpFilePath = path.join("uploads", webpFileName);

            await sharp(file.path)
                .webp({ quality: 80 })
                .toFile(webpFilePath);

            // Delete the original file after conversion (optional)
            fs.unlinkSync(file.path); // Delete the original file if you want to save only the WebP version
            console.log(webpFilePath, "webpFilePath")
            // Create a new League document and save the image file path to the database
            const newTeam = new PredictionTeam({
                team: team,
                image: webpFilePath, // Save the path to the WebP image
            });

            await newTeam.save();

            // Send the response back with success and the new league
            const allTeams = await PredictionTeam.find();
            res.send({
                success: true,
                message: "League added successfully",
                allTeams: allTeams,
            });
        } else {
            // Assuming you already have a user validation mechanism (you can customize it)
            const existingUser = await User.findOne({ email });
            if (!existingUser) {
                return res.status(401).json({ success: false, message: "User not found" });
            }


            // Create a new League document and save the image file path to the database
            const newTeam = new PredictionTeam({
                team: team,
                image: "", // Save the path to the WebP image
            });

            await newTeam.save();

            // Send the response back with success and the new league
            const allTeams = await PredictionTeam.find();
            res.send({
                success: true,
                message: "League added successfully",
                allTeams: allTeams,
            });

        }






    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});



// Route to create a league
router.post("/getLeague", async (req, res) => {
    try {
        console.log("vbfbfbfbfkvjhvhgcghghchgchvygcygvhgchgvbfb")
        const { email } = req.body;
        console.log(email, "vbfbfbfbfbfb")
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(401).json({ success: false, message: "User not found" });
        }
        // Send the response back with success and the new league
        const allLeagues = await PredictionLeague.find();
        res.send({
            success: true,
            message: "League sent successfully",
            leagues: allLeagues,
        });



    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});


// Route to create a league
router.post("/getTeam", async (req, res) => {
    try {
        console.log("vbfbfbfbfkvjhvhgcghghchgchvygcygvhgchgvbfb")
        const { email } = req.body;
        console.log(email, "vbfbfbfbfbfb")
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(401).json({ success: false, message: "User not found" });
        }
        // Send the response back with success and the new league
        const allTeams = await PredictionTeam.find();
        res.send({
            success: true,
            message: "Team sent successfully",
            allTeams: allTeams,
        });



    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});



// Route to create a league
router.post("/deleteLeague", async (req, res) => {
    try {
        const { id, email } = req.body;

        // Check if the user exists
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        // Check if the league exists
        const leagueToDelete = await PredictionLeague.findById(id);
        if (!leagueToDelete) {
            return res.status(404).json({ success: false, message: "League not found" });
        }

        // Get the image path
        const imagePath = leagueToDelete.image; // Assuming `image` stores the file path or URL

        // Delete the image file if stored locally
        if (imagePath && imagePath.startsWith("uploads/")) {
            const fullPath = path.join(__dirname, "../", imagePath);
            fs.unlink(fullPath, (err) => {
                if (err) {
                    console.error("Failed to delete image:", err);
                } else {
                    console.log("Image deleted successfully:", fullPath);
                }
            });
        }

        // Delete the league from the database
        await PredictionLeague.findByIdAndDelete(id);

        // Fetch the updated list of leagues
        const allLeagues = await PredictionLeague.find();

        res.send({
            success: true,
            message: "League and associated image deleted successfully",
            leagues: allLeagues,
        });
    } catch (error) {
        console.error("Error deleting league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});



router.post("/deleteTeam", async (req, res) => {
    try {
        const { id, email } = req.body;

        // Check if the user exists
        const existingUser = await User.findOne({ email });
        if (!existingUser) {
            return res.status(401).json({ success: false, message: "User not found" });
        }

        // Check if the league exists
        const TeamToDelete = await PredictionTeam.findById(id);
        if (!TeamToDelete) {
            return res.status(404).json({ success: false, message: "League not found" });
        }

        // Get the image path
        const imagePath = TeamToDelete.image; // Assuming `image` stores the file path or URL

        // Delete the image file if stored locally
        if (imagePath && imagePath.startsWith("uploads/")) {
            const fullPath = path.join(__dirname, "../", imagePath);
            fs.unlink(fullPath, (err) => {
                if (err) {
                    console.error("Failed to delete image:", err);
                } else {
                    console.log("Image deleted successfully:", fullPath);
                }
            });
        }

        // Delete the league from the database
        await PredictionTeam.findByIdAndDelete(id);

        // Fetch the updated list of leagues
        const allTeams = await PredictionTeam.find();

        res.send({
            success: true,
            message: "League and associated image deleted successfully",
            allTeams: allTeams,
        });
    } catch (error) {
        console.error("Error deleting league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});





router.post("/createMatchPrediction", async (req, res) => {
    try {
        const { time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, } = req.body; // Get email and league name from the request body

        console.log(time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, "These are the data")



        const newMatchPrediction = new MatchPrediction({
            time: time,
            league: league,
            league_flag: league_flag,
            team1: team1,
            team1_flag: team1_flag,
            team2: team2,
            team2_flag: team2_flag,
            tip: tip,
            status: "Pending"
        });

        await newMatchPrediction.save();

        // Send the response back with success and the new league
        const allMatch = await MatchPrediction.find();
        res.send({
            success: true,
            message: "Match added successfully",
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});



router.post("/createMatchPrediction2", async (req, res) => {
    try {
        const { time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, } = req.body; // Get email and league name from the request body

        console.log(time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, "These are the data")



        const newMatchPrediction = new SecondMatchPrediction({
            time: time,
            league: league,
            league_flag: league_flag,
            team1: team1,
            team1_flag: team1_flag,
            team2: team2,
            team2_flag: team2_flag,
            tip: tip,
            status: "Pending"
        });

        await newMatchPrediction.save();

        // Send the response back with success and the new league
        const allMatch = await SecondMatchPrediction.find();
        res.send({
            success: true,
            message: "Match added successfully",
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});




router.post("/updateMatchPrediction", async (req, res) => {
    try {
        const { time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, status, id } = req.body; // Get email and league name from the request body

        console.log(time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, "These are the data")


        // Use findByIdAndUpdate to find the match by ID and update the fields
        const updatedMatch = await MatchPrediction.findByIdAndUpdate(
            id, // The ID of the match to update
            {
                time: time,
                league: league,
                league_flag: league_flag,
                team1: team1,
                team1_flag: team1_flag,
                team2: team2,
                team2_flag: team2_flag,
                tip: tip,
                status: status || "Pending"
            },
            { new: true } // Return the updated document
        );

        if (!updatedMatch) {
            return res.status(404).json({ success: false, message: "Match not found" });
        }

        // Send the response back with success and the updated match
        res.send({
            success: true,
            message: "Match updated successfully",
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});


router.post("/updateMatchPrediction2", async (req, res) => {
    try {
        const { time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, status, id } = req.body; // Get email and league name from the request body

        console.log(time, league, league_flag, team1, team1_flag, team2, team2_flag, tip, "These are the data")


        // Use findByIdAndUpdate to find the match by ID and update the fields
        const updatedMatch = await SecondMatchPrediction.findByIdAndUpdate(
            id, // The ID of the match to update
            {
                time: time,
                league: league,
                league_flag: league_flag,
                team1: team1,
                team1_flag: team1_flag,
                team2: team2,
                team2_flag: team2_flag,
                tip: tip,
                status: status || "Pending"
            },
            { new: true } // Return the updated document
        );

        if (!updatedMatch) {
            return res.status(404).json({ success: false, message: "Match not found" });
        }

        // Send the response back with success and the updated match
        res.send({
            success: true,
            message: "Match updated successfully",
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});


router.post("/deleteMatchPrediction", async (req, res) => {
    try {
        const { id } = req.body; // Get the id of the match to delete

        // Find and delete the match by its id
        const deletedMatch = await MatchPrediction.findByIdAndDelete(id);

        if (!deletedMatch) {
            return res.status(404).json({ success: false, message: "Match not found" });
        }

        // Send a success response with a message
        res.send({
            success: true,
            message: "Match deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting match:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});


router.post("/deleteMatchPrediction2", async (req, res) => {
    try {
        const { id } = req.body; // Get the id of the match to delete

        // Find and delete the match by its id
        const deletedMatch = await SecondMatchPrediction.findByIdAndDelete(id);

        if (!deletedMatch) {
            return res.status(404).json({ success: false, message: "Match not found" });
        }

        // Send a success response with a message
        res.send({
            success: true,
            message: "Match deleted successfully"
        });

    } catch (error) {
        console.error("Error deleting match:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});




router.get("/getAllMatchPrediction", async (req, res) => {
    try {

        const allMatch = await MatchPrediction.find();
        res.send({
            success: true,
            message: "Match added successfully",
            allMatch: allMatch
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});

router.get("/getAllMatchPrediction2", async (req, res) => {
    try {

        const allMatch = await SecondMatchPrediction.find();
        res.send({
            success: true,
            message: "Match added successfully",
            allMatch: allMatch
        });

    } catch (error) {
        console.error("Error adding league:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
});
// Make sure you have the uploads directory created
const fs = require("fs");
if (!fs.existsSync("uploads")) {
    fs.mkdirSync("uploads");
}



module.exports = router;
// // Delete old image if it exists
// if (existingUser.imageFileName !== "") {
//     bucket
//         .file(`profileImages/${existingUser.imageFileName}`)
//         .delete()
//         .then(() => {
//             console.log("Previous image deleted successfully");
//         })
//         .catch((err) => {
//             console.error("Error deleting previous image:", err);
//             // Log the error but do not stop the process
//         });
// }