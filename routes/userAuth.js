/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const { check } = require("express-validator");
const SendEmail = require("../utils/mailer");

require("dotenv").config();
// FedaPay.setApiKey(process.env.FEDAPAY_KEY1);
// FedaPay.setEnvironment(process.env.ENVIRONMENT1);
const tokenVlaue = process.env.TOKEN_SECRET;

const loginValidate = [
  check("email").isEmail().withMessage("Please provide a valid email"),
  check("password")
    .isLength({ min: 4 })
    .withMessage("Password must be at least six characters"),
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

router.post("/setPin", checkOngoingTransaction, async (req, res) => {
  try {
    transactionInProgress = true;
    const { pin, email } = req.body;
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(501)
        .send({ success: 501, message: "User does not exists", status: 501 });
    }

    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    // Hash the pin
    const hashedPin = await bcryptjs.hash(pin, 10);

    // Set the user's session ID and isLoggedIn status
    existingUser.pin = hashedPin;
    existingUser.pinState = true;
    const savedUser = await existingUser.save();

    //create token data
    const tokenData = {
      _id: savedUser._id,
      fullname: savedUser.fullname,
      email: savedUser.email,
      isAdmin: savedUser.isAdmin,
      isUser: savedUser.isUser,
      isSubAdminDeposits: savedUser.isSubAdminDeposits,
      isSubAdminWithdrawals: savedUser.isSubAdminWithdrawals,
      sessionId: savedUser.sessionId,
      pinState: savedUser.pinState,
    };

    // create token
    const token = await jwt.sign(
      tokenData,
      tokenVlaue,
      //     {
      //     expiresIn: "1d", // "1m" stands for 1 minute
      // }
    );
    transactionInProgress = false;
    res.header("auth-token", token).send({
      success: true,
      message: "set Pin succesfully",
      token,
      status: 201,
      savedUser,
    });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error ligining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/getUser", checkOngoingTransaction, async (req, res) => {
  try {
    console.log("processed");
    transactionInProgress = true;
    const { token } = req.body;

    let decodedToken;
    try {
      decodedToken = jwt.verify(token, tokenVlaue);
    } catch (error) {
      // Check if the error is a TokenExpiredError
      if (error.name === "TokenExpiredError") {
        console.log("Token has expired");
        transactionInProgress = false;
        return res
          .status(504)
          .send({ success: false, message: "Token has expired", status: 504 });
      } else {
        transactionInProgress = false;
        // Throw other errors
        throw error;
      }
    }

    // Check if the user already exists
    const existingUser = await User.findOne({ email: decodedToken.email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(501)
        .send({ success: 501, message: "User does not exists", status: 501 });
    }

    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    if (existingUser.pinState === false) {
      transactionInProgress = false;
      return res.status(501).send({
        success: 503,
        message: "User pin is not set",
        status: 503,
        email: existingUser.email,
        fullname: existingUser.fullname,
      });
    }

    // Generate a new session ID using the 'uuid' library
    const newSessionId = generateUniqueSessionId();

    // Check for existing session and invalidate it
    if (existingUser.isAdmin === false) {
      if (existingUser.sessionId) {
        // Implement your session invalidation logic here (e.g., update the database record)
        invalidateSession(existingUser.sessionId);
      }
    }

    // Set the user's session ID and isLoggedIn status
    existingUser.sessionId = newSessionId;
    existingUser.isLoggedIn = true;
    const savedUser = await existingUser.save();

    //create token data
    const tokenData = {
      _id: savedUser._id,
      fullname: savedUser.fullname,
      email: savedUser.email,
      isAdmin: savedUser.isAdmin,
      isUser: savedUser.isUser,
      isSubAdminDeposits: savedUser.isSubAdminDeposits,
      isSubAdminWithdrawals: savedUser.isSubAdminWithdrawals,
      sessionId: savedUser.sessionId,
      pinState: savedUser.pinState,
    };

    // create token
    const newToken = await jwt.sign(tokenData, tokenVlaue);
    transactionInProgress = false;
    res.header("auth-token", token).send({
      success: true,
      message: "successfully fetched data",
      newToken,
      status: 201,
      savedUser,
    });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error ligining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post(
  "/verifyUserPin",
  checkOngoingTransaction,
  loginValidate,
  async (req, res) => {
    try {
      transactionInProgress = true;
      const { pin, email } = req.body;

      console.log(pin, email, "pin, email");

      // Check if the user already exists
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        transactionInProgress = false;
        return res
          .status(501)
          .send({ success: 501, message: "User does not exists", status: 501 });
      }

      if (!existingUser.isActivated) {
        transactionInProgress = false;
        return res
          .status(502)
          .send({ success: 502, message: "User is deactivated", status: 502 });
      }

      // Check if password is correct
      const validPin = await bcryptjs.compare(pin, existingUser.pin);
      if (!validPin) {
        transactionInProgress = false;
        return res
          .status(503)
          .send({ success: 503, message: "Invalid pin", status: 503 });
      }

      // Generate a new session ID using the 'uuid' library
      const newSessionId = generateUniqueSessionId();

      // Check for existing session and invalidate it
      if (existingUser.isAdmin === false) {
        if (existingUser.sessionId) {
          // Implement your session invalidation logic here (e.g., update the database record)
          invalidateSession(existingUser.sessionId);
        }
      }

      // Set the user's session ID and isLoggedIn status
      existingUser.sessionId = newSessionId;
      existingUser.isLoggedIn = true;
      const savedUser = await existingUser.save();

      //create token data
      const tokenData = {
        _id: savedUser._id,
        fullname: savedUser.fullname,
        email: savedUser.email,
        isAdmin: savedUser.isAdmin,
        isUser: savedUser.isUser,
        isSubAdminDeposits: savedUser.isSubAdminDeposits,
        isSubAdminWithdrawals: savedUser.isSubAdminWithdrawals,
        sessionId: savedUser.sessionId,
      };

      // create token
      const token = await jwt.sign(
        tokenData,
        tokenVlaue,
        //     {
        //     expiresIn: "1d", // "1m" stands for 1 minute
        // }
      );
      transactionInProgress = false;
      res.header("auth-token", token).send({
        success: true,
        message: "Logged in succesfully",
        token,
        status: 201,
        savedUser,
      });
    } catch (error) {
      transactionInProgress = false;
      console.error("Error logining in user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);







router.post(
  "/getUpdatedData",
  checkOngoingTransaction,
  loginValidate,
  async (req, res) => {
    try {
      transactionInProgress = true;
      const { email } = req.body;

      console.log(email, "pin, email");

      // Check if the user already exists
      const existingUser = await User.findOne({ email });
      if (!existingUser) {
        transactionInProgress = false;
        return res
          .status(501)
          .send({ success: 501, message: "User does not exists", status: 501 });
      }

      if (!existingUser.isActivated) {
        transactionInProgress = false;
        return res
          .status(502)
          .send({ success: 502, message: "User is deactivated", status: 502 });
      }

      const savedUser = existingUser;

      transactionInProgress = false;
      res
        .status(201)
        .json({
          success: true,
          message: "Succesfully",
          status: 201,
          savedUser,
        });
    } catch (error) {
      transactionInProgress = false;
      console.error("Error logining in user:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);





router.post("/resetPasswordForLoggedInUser", async (req, res) => {
  try {
    const { email, password, newPassword } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(501)
        .send({ success: 501, message: "User does not exists", status: 501 });
    }

    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    const validPassword = await bcryptjs.compare(
      password,
      existingUser.password,
    );
    if (!validPassword) {
      transactionInProgress = false;
      return res
        .status(503)
        .send({ success: 503, message: "Invalid password", status: 503 });
    }

    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    existingUser.password = hashedPassword;

    // console.log("second check")
    // await SendEmail({
    //     email,
    //     userId: existingUser._id,
    //     emailType: "RESET",
    //     fullname: existingUser.fullname,
    // });
    await existingUser.save();
    transactionInProgress = false;
    return res
      .status(201)
      .send({ success: true, message: "successful", status: 201 });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error logining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/requestPin", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(501)
        .send({ success: 501, message: "User does not exists", status: 501 });
    }

    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    await SendEmail({
      email,
      userId: existingUser._id,
      emailType: "RESETPINFORAPP",
      fullname: existingUser.fullname,
    });

    await existingUser.save();
    transactionInProgress = false;
    return res
      .status(201)
      .send({ success: true, message: "successful", status: 201 });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error logining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checkPin", async (req, res) => {
  try {
    const submittedPin = req.body.pin;
    const userId = req.body.id;

    console.log(submittedPin, userId);
    const user = await User.findById(userId);

    if (user && user.pinreset === submittedPin) {
      if (user.pinExpiryTime > Date.now()) {
        return res.status(201).send({
          success: true,
          message: "PIN verification successful",
          status: 201,
        });
      } else {
        res.status(401).send("PIN has expired. Please request a new one.");
      }
    } else {
      res.status(402).send("Invalid PIN or user ID.");
    }
  } catch (error) {
    console.error("Error logining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/changeColorScheme", async (req, res) => {
  try {
    const email = req.body.email;
    console.log(email, "ertyuioiuyt");
    const existingUser = await User.findOne({ email });
    console.log(existingUser.colorScheme);
    if (existingUser.colorScheme === 2) {
      existingUser.colorScheme = 1;
      await existingUser.save();
    } else if (existingUser.colorScheme === 1) {
      existingUser.colorScheme = 2;
      await existingUser.save();
    }

    res.status(201).send({
      success: true,
      message: "colorScheme changed succesfully",
      status: 201,
      existingUser,
    });
  } catch (error) {
    console.error("Error logining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/changeUserPin", async (req, res) => {
  try {
    const { pin, email } = req.body;
    console.log(pin, email, "email");

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      transactionInProgress = false;
      return res
        .status(501)
        .send({ success: 501, message: "User does not exists", status: 501 });
    }

    if (!existingUser.isActivated) {
      transactionInProgress = false;
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    // Hash the pin
    const hashedPin = await bcryptjs.hash(pin, 10);

    // Set the user's session ID and isLoggedIn status
    existingUser.pin = hashedPin;

    await existingUser.save();

    res
      .status(201)
      .send({ success: true, message: "set Pin succesfully", status: 201 });
  } catch (error) {
    transactionInProgress = false;
    console.error("Error ligining in user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/setTag", async (req, res) => {
  try {
    const { email, tag } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(501)
        .send({ success: 501, message: "User does not exist", status: 501 });
    }

    if (!existingUser.isActivated) {
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    if (existingUser.tag === tag) {
      return res
        .status(503)
        .send({ success: 503, message: "Tag is the same as old", status: 503 });
    }

    // Fetch all existing tags once
    const allUsers = await User.find({}, { tag: 1 });
    const existingTags = allUsers.map((user) => user.tag);

    // Check if the incoming tag matches any user's tag
    if (existingTags.includes(tag)) {
      // Generate tag suggestions
      const suggestions = await generateTagSuggestions(tag, existingTags);
      return res.status(504).send({
        success: 504,
        message: "Tag already exists",
        suggestions,
        status: 504,
      });
    }

    // Update the user's tag if no conflicts
    existingUser.tag = tag;
    await existingUser.save();
    const updatedTag = tag;

    return res
      .status(201)
      .send({
        success: true,
        message: "Tag successfully updated",
        status: 201,
        updatedTag,
      });
  } catch (error) {
    console.error("Error updating user tag:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Function to generate tag suggestions
const generateTagSuggestions = async (tag, existingTags) => {
  let suggestions = [];
  const baseTag = tag.slice(0, 10); // Get the first 10 characters of the incoming tag
  let i = 1;
  while (suggestions.length < 3) {
    const newTag = `${baseTag}${i}`;
    if (!existingTags.includes(newTag)) {
      suggestions.push(newTag);
    }
    i++;
  }
  return suggestions;
};

router.post("/getTotalReferral", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (!existingUser) {
      return res
        .status(501)
        .send({ success: 501, message: "User does not exist", status: 501 });
    }

    if (!existingUser.isActivated) {
      return res
        .status(502)
        .send({ success: 502, message: "User is deactivated", status: 502 });
    }

    const referralUsers = await Promise.all(
      existingUser.referrals.map(async (referralEmail) => {
        const user = await User.findOne({ email: referralEmail });
        if (user) {
          return {
            _id: uuidv4(),
            fullname: user.fullname,
            image:
              user.image === ""
                ? "https://firebasestorage.googleapis.com/v0/b/groupchat-d6de7.appspot.com/o/Untitled%20design%20(4)%20(1).png?alt=media&token=7f06a2ba-e4c5-49a2-a029-b6688c9be61d"
                : user.image,
            status: user.pinState === false ? "Pending" : "Completed",
            time: user.registrationDateTime,
          };
        }
        return null; // Handle the case where user is not found
      }),
    );

    // Filter out any null values in case some users were not found
    const filteredReferralUsers = referralUsers.filter((user) => user !== null);

    return res
      .status(201)
      .send({
        success: true,
        message: "Referral fetched",
        status: 201,
        filteredReferralUsers,
      });
  } catch (error) {
    console.error("Error updating user tag:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Function to invalidate a session (update the database record)
async function invalidateSession(sessionId) {
  try {
    // Find the user with the given session ID and update the session or remove it
    const user = await User.findOneAndUpdate(
      { sessionId },
      { $set: { sessionId: null, isLoggedIn: false } },
      { new: true },
    );

    if (!user) {
      // Handle if the user is not found
      console.error("User not found for session ID:", sessionId);
    }
  } catch (error) {
    // Handle any error during the database update
    console.error("Error invalidating session:", error);
  }
}

// Function to send push notifications
const generateUserTag = async (count) => {
  console.log(count);
  // Generate a unique identifier (e.g., using uuid or a custom function)
  const tag = `betfundr${count + 1}`;

  return tag;
};

// Call the function to send the notification
generateUserTag();

function generateUniqueSessionId() {
  return uuidv4();
}

module.exports = router;
