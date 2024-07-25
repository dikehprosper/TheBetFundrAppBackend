/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
require("dotenv").config();
const AWS = require("aws-sdk");
const bcryptjs = require("bcryptjs");
const User = require("../models/user");
const DOMAIN = "https://betfundr.com"

async function SendEmail({ email, emailType, userId, fullname }) {
  console.log("third check");
  try {
    const hashedToken = await bcryptjs.hash(userId.toString(), 10);

    const encodedHash = encodeURIComponent(hashedToken);

    console.log(encodedHash, "encodedHash")
    const randomNumbers = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 9) + 1
    );
    const randomNumbersString = randomNumbers.join("");

    const twoHoursInMillis = 2 * 60 * 60 * 1000; // Convert 2 hours to milliseconds

    const expiryTime = Date.now() + twoHoursInMillis;

    if (emailType === "RESET") {
      await User.findByIdAndUpdate(userId, {
        forgotPasswordToken: encodedHash,
        forgotPasswordTokenExpiry: expiryTime,
      });
    }

    const generateRandomPin = () => {
      const pinDigits = Array.from({ length: 5 }, () =>
        Math.floor(Math.random() * 10)
      ); // Generate 5 random digits (0-9)
      return pinDigits.join(""); // Concatenate the digits into a string
    };

    // Generate the PIN and calculate its expiry time
    const pin = generateRandomPin();
    const pinExpiryTime = Date.now() + 2 * 60 * 60 * 1000; // Set expiry time to 2 hours from now

    // Update the document in the database with the generated PIN and expiry time
    if (emailType === "RESETPINFORAPP") {
      await User.findByIdAndUpdate(userId, {
        pinreset: pin, // Save the generated PIN
        pinExpiryTime: pinExpiryTime, // Save the expiry time for the PIN
      });
    }

    if (emailType === "VERIFY") {
      await User.findByIdAndUpdate(userId, {
        verifyToken: encodedHash,
        verifyTokenExpiry: Date.now() + 86400000,
      });
    }

    if (emailType === "SEND") {
      await User.findByIdAndUpdate(userId, {
        faToken: randomNumbersString,
        faTokenExpiry: Date.now() + 7200000,
      });
    }

    const adminEmail = process.env.EMAIL;

    const SES_CONFIG = {
      accessKeyId: process.env.AWS_ACCESS_KEY,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION,
    };

    const AWS_SES = new AWS.SES(SES_CONFIG);

    if (emailType === "RESETPINFORAPP") {
      let params = {
        Source: adminEmail,
        Destination: {
          ToAddresses: ["dikehprosper@gmail.com"],
        },
        ReplyToAddresses: [],
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            text-align: center;
            width: 100%;
            height: 100%;
            background-color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            text-align: center;
            width: 100%;
            height: auto;
            align-self: center;
            margin: 0px auto;

        }

        .image {
            text-align: center;
            align-self: center;
        }

        .content {
            width: 100%;
            height: 420px;
            background-color: white;

            align-self: center;
            margin: 35px auto;
        }

        h3 {
            text-align: center;
            color: black;
            font-size: 24px;
        }

        p {
            font-size: 18px;
            font-family: Arial, sans-serif;
            color: #999999;
        }

        .reset-link {
            font-weight: bold;
            color: white;
            text-decoration: none;
            width: 100%;
             display: flex;
             justify-content: center;

        }

         .reset-link-inner {
  width: 300px;
   padding: 17px 37px;
   background-color: rgba(73, 166, 106, 1);
        border-radius: 8px;
        align-self: center;
     color: white;
     fontSize: 17px
         }

         .reset-link a {
            text-decoration: none;
            color: white;
            font-weight: bold;
              margin: 0px auto
        }

        .url {
            color: black;
            font-size: 15px;
            line-height: 23px;

        }

        .url > p {
          color: blue;
          text-decoration: none;
        }

        .expiration {
            color: #afafaf;
            font-size: 15px;
            color: black;

        }

        .footer {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;

            color: black;
            text-decoration: none;
        }

        .footer1 {
            text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
            text-decoration: none;
            margin-top: 30px; /* Space added here */
        }

        .footer-links {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
        }
    </style>
</head>

<body>
    <div class="container">

        <div class="content">
         <div class="image">
            <img src="https://firebasestorage.googleapis.com/v0/b/groupchat-d6de7.appspot.com/o/unnamed-removebg-preview.png?alt=media&token=870af961-9ab3-47df-9226-c18bd1019d24" alt="Firebase Image" width="280" height="80">
        </div>
            <h3>Bonjour ${fullname}</h3>
          
            <p>Vous trouverez ci-dessous votre code PIN à cinq chiffres</p>
            <div class="reset-link">

            <div class="reset-link-inner">
            ${pin}
            </div>

            </div>
              <p class="expiration">
              Ce lien expirera dans 2 heures.
            </p

             <p class="footer1">© Betfundr | Address here</p>

    <p class="footer">
      Si vous avez des questions, veuillez nous contacter au
        <a href="" style="color: black;">contact@betfundr.com</a>
    </p>
        </div>
       
    </div>
   

</body>
</html>

          `,
            },
            Text: {
              Charset: "UTF-8",
              Data: `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            text-align: center;
            width: 100%;
            height: 100%;
            background-color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            text-align: center;
            width: 100%;
            height: auto;
            align-self: center;
            margin: 0px auto;

        }

        .image {
            text-align: center;
            align-self: center;
        }

        .content {
            width: 100%;
            height: 420px;
            background-color: white;

            align-self: center;
            margin: 35px auto;
        }

        h3 {
            text-align: center;
            color: black;
            font-size: 24px;
        }

        p {
            font-size: 18px;
            font-family: Arial, sans-serif;
            color: #999999;
        }

        .reset-link {
            font-weight: bold;
            color: white;
            text-decoration: none;
            width: 100%;
             display: flex;
             justify-content: center;

        }

         .reset-link-inner {
  width: 300px;
   padding: 17px 37px;
   background-color: rgba(73, 166, 106, 1);
        border-radius: 8px;
        align-self: center;
     color: white;
     fontSize: 13px
         }

         .reset-link a {
            text-decoration: none;
            color: white;
            font-weight: bold;
              margin: 0px auto
        }

        .url {
            color: black;
            font-size: 15px;
            line-height: 23px;

        }

        .url > p {
          color: blue;
          text-decoration: none;
        }

        .expiration {
            color: #afafaf;
            font-size: 15px;
            color: black;

        }

        .footer {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;

            color: black;
            text-decoration: none;
        }

        .footer1 {
            text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
            text-decoration: none;
            margin-top: 30px; /* Space added here */
        }

        .footer-links {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
        }
    </style>
</head>

<body>
    <div class="container">

        <div class="content">
         <div class="image">
            <img src="https://firebasestorage.googleapis.com/v0/b/groupchat-d6de7.appspot.com/o/unnamed-removebg-preview.png?alt=media&token=870af961-9ab3-47df-9226-c18bd1019d24" alt="Firebase Image" width="280" height="80">
        </div>
            <h3>Bonjour ${fullname}</h3>
            <p>Mot de passe oublié?</p>
            <p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le bouton ci-dessous</p>
            <div class="reset-link">

                <a href="${DOMAIN}/resetpassword?token=${encodedHash}">
                              <div class="reset-link-inner">
                             RÉINITIALISEZ VOTRE MOT DE PASSE
                                          </div>
                              </a>

               </div>
            <p class="expiration">
              Ce lien expirera dans 2 heures.
            </p>
        </div>
    </div>
    <p class="footer1">© Betfundr | Address here</p>

    <p class="footer">
      Si vous avez des questions, veuillez nous contacter au
        <a href="" style="color: black;">contact@betfundr.com</a>
    </p>

</body>
</html>

          `,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: `Bonjour, ${fullname},  Réinitialisez votre mot de passe`,
          },
        },
      };
      const mailresponse = await AWS_SES.sendEmail(params).promise();
      console.log(mailresponse, "Email has been Sent");
      return mailresponse;
    } else {
      let params = {
        Source: adminEmail,
        Destination: {
          ToAddresses: [email],
        },
        ReplyToAddresses: [],
        Message: {
          Body: {
            Html: {
              Charset: "UTF-8",
              Data: `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            text-align: center;
            width: 100%;
            height: 100%;
            background-color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            text-align: center;
            width: 100%;
            height: auto;
            align-self: center;
            margin: 0px auto;

        }

        .image {
            text-align: center;
            align-self: center;
        }

        .content {
            width: 100%;
            height: 420px;
            background-color: white;

            align-self: center;
            margin: 35px auto;
        }

        h3 {
            text-align: center;
            color: black;
            font-size: 24px;
        }

        p {
            font-size: 18px;
            font-family: Arial, sans-serif;
            color: #999999;
        }

        .reset-link {
            font-weight: bold;
            color: white;
            text-decoration: none;
            width: 100%;
             display: flex;
             justify-content: center;

        }

         .reset-link-inner {
  width: 300px;
   padding: 17px 37px;
   background-color: rgba(73, 166, 106, 1);
        border-radius: 8px;
        align-self: center;
     color: white;
     fontSize: 13px
         }

         .reset-link a {
            text-decoration: none;
            color: white;
            font-weight: bold;
              margin: 0px auto
        }

        .url {
            color: black;
            font-size: 15px;
            line-height: 23px;

        }

        .url > p {
          color: blue;
          text-decoration: none;
        }

        .expiration {
            color: #afafaf;
            font-size: 15px;
            color: black;

        }

        .footer {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;

            color: black;
            text-decoration: none;
        }

        .footer1 {
            text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
            text-decoration: none;
            margin-top: 30px; /* Space added here */
        }

        .footer-links {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
        }
    </style>
</head>

<body>
    <div class="container">

        <div class="content">
         <div class="image">
            <img src="https://firebasestorage.googleapis.com/v0/b/groupchat-d6de7.appspot.com/o/unnamed-removebg-preview.png?alt=media&token=870af961-9ab3-47df-9226-c18bd1019d24" alt="Firebase Image" width="280" height="80">
        </div>
            <h3>Bonjour ${fullname}</h3>
            <p>Mot de passe oublié?</p>
            <p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le bouton ci-dessous</p>
            <div class="reset-link">

                <a href="${DOMAIN}/resetpassword?token=${encodedHash}">
                              <div class="reset-link-inner">
                             RÉINITIALISEZ VOTRE MOT DE PASSE
                                          </div>
                              </a>

               </div>
            <p class="expiration">
              Ce lien expirera dans 2 heures.
            </p>
        </div>
    </div>
    <p class="footer1">© Betfundr | Address here</p>

    <p class="footer">
      Si vous avez des questions, veuillez nous contacter au
        <a href="" style="color: black;">contact@betfundr.com</a>
    </p>

</body>
</html>

          `,
            },
            Text: {
              Charset: "UTF-8",
              Data: `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            text-align: center;
            width: 100%;
            height: 100%;
            background-color: white;
            font-family: Arial, sans-serif;
        }

        .container {
            text-align: center;
            width: 100%;
            height: auto;
            align-self: center;
            margin: 0px auto;

        }

        .image {
            text-align: center;
            align-self: center;
        }

        .content {
            width: 100%;
            height: 420px;
            background-color: white;

            align-self: center;
            margin: 35px auto;
        }

        h3 {
            text-align: center;
            color: black;
            font-size: 24px;
        }

        p {
            font-size: 18px;
            font-family: Arial, sans-serif;
            color: #999999;
        }

        .reset-link {
            font-weight: bold;
            color: white;
            text-decoration: none;
            width: 100%;
             display: flex;
             justify-content: center;

        }

         .reset-link-inner {
  width: 300px;
   padding: 17px 37px;
   background-color: rgba(73, 166, 106, 1);
        border-radius: 8px;
        align-self: center;
     color: white;
     fontSize: 13px
         }

         .reset-link a {
            text-decoration: none;
            color: white;
            font-weight: bold;
              margin: 0px auto
        }

        .url {
            color: black;
            font-size: 15px;
            line-height: 23px;

        }

        .url > p {
          color: blue;
          text-decoration: none;
        }

        .expiration {
            color: #afafaf;
            font-size: 15px;
            color: black;

        }

        .footer {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;

            color: black;
            text-decoration: none;
        }

        .footer1 {
            text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
            text-decoration: none;
            margin-top: 30px; /* Space added here */
        }

        .footer-links {
                 text-align: center;
            font-size: 12px;
            font-family: Arial, sans-serif;
            color: black;
        }
    </style>
</head>

<body>
    <div class="container">

        <div class="content">
         <div class="image">
            <img src="https://firebasestorage.googleapis.com/v0/b/groupchat-d6de7.appspot.com/o/unnamed-removebg-preview.png?alt=media&token=870af961-9ab3-47df-9226-c18bd1019d24" alt="Firebase Image" width="280" height="80">
        </div>
            <h3>Bonjour ${fullname}</h3>
            <p>Mot de passe oublié?</p>
            <p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le bouton ci-dessous</p>
            <div class="reset-link">

                <a href="${DOMAIN}/resetpassword?token=${encodedHash}">
                              <div class="reset-link-inner">
                             RÉINITIALISEZ VOTRE MOT DE PASSE
                                          </div>
                              </a>

               </div>
            <p class="expiration">
              Ce lien expirera dans 2 heures.
            </p>
        </div>
    </div>
    <p class="footer1">© Betfundr | Address here</p>

    <p class="footer">
      Si vous avez des questions, veuillez nous contacter au
        <a href="" style="color: black;">contact@betfundr.com</a>
    </p>

</body>
</html>

          `,
            },
          },
          Subject: {
            Charset: "UTF-8",
            Data: `Bonjour, ${fullname},  Réinitialisez votre mot de passe`,
          },
        },
      };
      const mailresponse = await AWS_SES.sendEmail(params).promise();
      console.log(mailresponse, "Email has been Sent");
      return mailresponse;
    }
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = SendEmail;
