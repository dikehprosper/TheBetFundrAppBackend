/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
require("dotenv").config();
const nodemailer = require("nodemailer");
const bcryptjs = require("bcryptjs");
const User = require("../models/user");
const DOMAIN = "https://LamedCash.com"

async function SendEmail({ email, emailType, userId, fullname, amount, betId, recipient }) {
  console.log("third check");
  try {
    const hashedToken = await bcryptjs.hash(userId.toString(), 10);

    const encodedHash = encodeURIComponent(hashedToken);

    console.log(encodedHash, "encodedHash");
    const randomNumbers = Array.from(
      { length: 4 },
      () => Math.floor(Math.random() * 9) + 1
    );
    const randomNumbersString = randomNumbers.join("");

    const twoHoursInMillis = 2 * 60 * 60 * 1000; // Convert 2 hours to milliseconds

    const expiryTime = Date.now() + twoHoursInMillis;

  
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
    if (emailType === "RESET") {
      await User.findByIdAndUpdate(userId, {
        pinreset: pin, // Save the generated PIN
        pinExpiryTime: pinExpiryTime,
      });
    } 







    const adminEmail = process.env.EMAIL;
      const primaryemail = process.env.EMAIL;
      const primaryemail_key = process.env.EMAIL_KEY;


    // Set up Nodemailer transport
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or another email service
      auth: {
          user: primaryemail, // your email
          pass: primaryemail_key, // your email password or app password
      },
    });

    let mailOptions = {
      from: adminEmail,
      to: email,
      subject: "",
      html: "",
    };



    // await SendEmail({
    //   email: email,
    //   userId: user._id,
    //   emailType: "SUCCESSFULDEPOSIT",
    //   fullname: user.fullname,
    //   amount: amount,
    //   betId: betId,
    // });



    if (emailType === "RESETPINFORAPP") {
      mailOptions.subject = `Bonjour, ${fullname}, Voici votre code PIN`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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

                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
              </div>

          </div>


      </body>
      </html>`;
    } else if (emailType === "WELCOME") {
      mailOptions.subject = `Bonjour, ${fullname}, Bienvenue sur LamedCash`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p>Commencez à effectuer des transactions sur l'application ou le site Web pour gagner des bonus et parrainez également vos amis pour gagner plus.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
              </div>
             
          </div>
         

      </body>
      </html>`;
    }

    else if (emailType === "SUCCESSFULDEPOSIT") {
      mailOptions.subject = `Félicitations, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Votre dépôt de ${amount} sur ${betId} a été effectué avec succès.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>


      </body>
      </html>`;
    } else if (emailType === "FAILEDDEPOSIT") {
      mailOptions.subject = `Désolé, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Votre dépôt de ${amount} sur ${betId} n'a pas réussi.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>
         

      </body>
      </html>`;
    }




    else if (emailType === "PENDINGWITHDRAWAL") {
      mailOptions.subject = `Bonjour, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Votre retrait de ${amount} sur ${betId} est actuellement en cours d'examen.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>


      </body>
      </html>`;
    } else if (emailType === "FAILEDWITHDRAWAL") {
      mailOptions.subject = `Désolé, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Votre retrait de ${amount} sur ${betId} n'a pas réussi.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>


      </body>
      </html>`;
    }
    else if (emailType === "SUCCESSFULWALLETSEND") {
      mailOptions.subject = `Bonjour, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Votre demande d'envoi d'un montant ${amount} à ${recipient} a réussi.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>
         

      </body>
      </html>`;
    }


    else if (emailType === "SUCCESSFULBONUS") {
      mailOptions.subject = `Bonjour, ${fullname}`;
      mailOptions.html = `
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
        width: 100%;
         height: 47px;

              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 23px;
           letter-spacing: 10px
               }

               .reset-link a {
                  text-decoration: none;
                  color: white;
                  font-weight: bold;
                    margin: 0px auto
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
                  <p> Vous venez de recevoir un bonus de ${amount}, vous pouvez le visualiser et le voir sur l'application.</p>
                   <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>
          </div> 
          </div>
         

      </body>
      </html>`;
    }
    



    else {
      mailOptions.subject = `Bonjour, ${fullname}, Réinitialisez votre mot de passe`;
      mailOptions.html = `
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
        width: 100%;
            height: 47px;
              border-radius: 8px;
              align-self: center;
           color: black;
           fontSize: 18px;
           letter-spacing: 10px
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

                  <h3>Bonjour ${fullname}</h3>
                  <p>Mot de passe oublié?</p>
                  <p>Pour réinitialiser votre mot de passe, veuillez cliquer sur le bouton ci-dessous</p>
            <p>Vous trouverez ci-dessous votre code PIN à cinq chiffres</p>
                  <div class="reset-link">

                  <div class="reset-link-inner">
                  ${pin}
                  </div>

                  </div>
                    <p class="expiration">
                    Ce lien expirera dans 2 heures.
                  </p
              </div>
          </div>
          <p class="footer1">© LamedCash | Benin</p>

          <p class="footer">
            Si vous avez des questions, veuillez nous contacter au
              <a href="" style="color: black;">lamedcash@gmail.com</a>
          </p>

      </body>
      </html>`;
      
    }

    // Send the email
    const mailresponse = await transporter.sendMail(mailOptions);
    console.log(mailresponse, "Email has been Sent");
    return mailresponse;

  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = SendEmail;
