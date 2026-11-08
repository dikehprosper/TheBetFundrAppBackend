const multer = require('multer')
const { AppError } = require('../utils/handlers')

const IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MEDIA = new Set([...IMAGE, 'video/mp4', 'video/quicktime'])

const make = (allowed, fileSize) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize, files: 10 },
  fileFilter: (_req, file, cb) => (allowed.has(file.mimetype) ? cb(null, true) : cb(new AppError(400, 'Unsupported file type')))
})

const imageUpload = make(IMAGE, 10 * 1024 * 1024)
const mediaUpload = make(MEDIA, 50 * 1024 * 1024)

module.exports = { imageUpload, mediaUpload }
