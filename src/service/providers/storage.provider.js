const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')

/**
 * File storage. STORAGE_DRIVER=local (default, dev/test) or firebase (production, same bucket the
 * original app used). Both return { url, fileName }.
 */
const driver = () => (process.env.STORAGE_DRIVER || 'local').toLowerCase()
const safeName = (name) => `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${String(name).replace(/[^a-zA-Z0-9._-]/g, '_')}`

let firebaseBucket = null
function bucket () {
  if (firebaseBucket) return firebaseBucket
  const admin = require('firebase-admin')
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH))),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    })
  }
  firebaseBucket = admin.storage().bucket()
  return firebaseBucket
}

async function save ({ buffer, originalName, contentType, folder = 'files' }) {
  const fileName = `${folder}/${safeName(originalName)}`
  if (driver() === 'firebase') {
    const file = bucket().file(fileName)
    await file.save(buffer, { contentType, resumable: false })
    await file.makePublic()
    return { fileName, url: `https://storage.googleapis.com/${bucket().name}/${fileName}` }
  }
  const root = path.resolve(process.env.STORAGE_LOCAL_DIR || 'uploads')
  const target = path.join(root, fileName)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, buffer)
  return { fileName, url: `${process.env.DOMAIN || ''}/uploads/${fileName}` }
}

async function remove (fileName) {
  if (!fileName) return
  try {
    if (driver() === 'firebase') await bucket().file(fileName).delete()
    else await fs.unlink(path.join(path.resolve(process.env.STORAGE_LOCAL_DIR || 'uploads'), fileName))
  } catch (_error) {
    // already gone: deleting is idempotent
  }
}

module.exports = { save, remove }
