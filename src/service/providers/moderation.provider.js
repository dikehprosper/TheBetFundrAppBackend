/**
 * Image moderation (AWS Rekognition). Off unless MODERATION_ENABLED=true.
 * Returns the offending labels (empty array = image is fine).
 */
async function moderationLabels (buffer) {
  if (process.env.MODERATION_ENABLED !== 'true') return []
  const { RekognitionClient, DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition')
  const rekognition = new RekognitionClient({
    region: process.env.AWS_REGION || 'eu-west-1',
    credentials: process.env.AWS_SES_ACCESS_ID
      ? { accessKeyId: process.env.AWS_SES_ACCESS_ID, secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY }
      : undefined
  })
  const result = await rekognition.send(new DetectModerationLabelsCommand({ Image: { Bytes: buffer }, MinConfidence: 70 }))
  return (result.ModerationLabels || []).map((label) => label.Name)
}

module.exports = { moderationLabels }
