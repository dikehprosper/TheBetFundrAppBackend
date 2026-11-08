const sharp = require('sharp')
const providers = require('./providers')
const { AppError } = require('../utils/handlers')

/**
 * Re-encode every uploaded image (strips metadata and any payload hidden in the file) and
 * refuse anything that is not really an image, whatever its extension or declared type says.
 */
async function prepareImage (buffer, { width = 1080, height = 1080, fit = 'inside' } = {}) {
  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate()
      .resize({ width, height, fit, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
  } catch (_error) {
    throw new AppError(400, 'The uploaded file is not a valid image')
  }
}

async function assertImageAllowed (buffer) {
  const labels = await providers.moderation.moderationLabels(buffer)
  if (labels.length) throw new AppError(400, 'This image is not allowed')
}

module.exports = { prepareImage, assertImageAllowed }
