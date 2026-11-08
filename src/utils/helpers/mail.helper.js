const AWS = require('../../config/aws.config')
const logger = require('../../config/logger.config')
const { templates } = require('./mail.templates')

const mailDisabled = () => process.env.MAIL_DISABLED === 'true' || process.env.NODE_ENV === 'test'

async function sendMail ({ to, subject, html }) {
  if (mailDisabled()) {
    logger.info({ to, subject }, 'mail disabled: not sending')
    return false
  }
  const ses = new AWS.SES({ apiVersion: '2010-12-01' })
  await ses
    .sendEmail({
      Source: process.env.SES_SENDER,
      Destination: { ToAddresses: [to] },
      Message: { Subject: { Data: subject, Charset: 'UTF-8' }, Body: { Html: { Data: html, Charset: 'UTF-8' } } }
    })
    .promise()
  return true
}

/**
 * Send a templated email. Email is a side effect, never part of the money path:
 * a mail outage must not fail or roll back a payment, so errors are logged and swallowed.
 */
async function sendTemplate (type, to, data) {
  try {
    const build = templates[type]
    if (!build) throw new Error(`unknown email template ${type}`)
    return await sendMail({ to, ...build(data) })
  } catch (error) {
    logger.error({ err: error, type }, 'failed to send email')
    return false
  }
}

module.exports = { sendMail, sendTemplate }
