const AWS = require('aws-sdk')

if (process.env.AWS_SES_ACCESS_ID && process.env.AWS_SES_SECRET_ACCESS_KEY) {
  AWS.config.update({
    accessKeyId: process.env.AWS_SES_ACCESS_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'eu-west-1'
  })
}

module.exports = AWS
