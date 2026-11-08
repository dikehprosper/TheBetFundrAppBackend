/**
 * Create (or update) the platform admin from ADMIN_EMAIL / ADMIN_PASSWORD.
 * The old app created an admin automatically for a hardcoded email + password. That backdoor is gone:
 * the admin now exists only because you ran this, with credentials only you know.
 *     npm run seed:admin
 */
require('dotenv').config()
const bcrypt = require('bcryptjs')
const { sequelize, User } = require('../src/models')

async function main () {
  const { ADMIN_EMAIL: email, ADMIN_PASSWORD: password } = process.env
  const fullname = process.env.ADMIN_FULLNAME || 'Platform Admin'
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set')
  if (password.length < 10) throw new Error('ADMIN_PASSWORD must be at least 10 characters')

  const passwordHash = await bcrypt.hash(password, 12)
  const existing = await User.findOne({ where: sequelize.where(sequelize.fn('lower', sequelize.col('email')), email.toLowerCase()) })
  if (existing) {
    await existing.update({ passwordHash, role: 'admin', isActivated: true })
    console.log(`updated admin ${email}`)
  } else {
    await User.create({ fullname, email: email.toLowerCase(), passwordHash, role: 'admin', pinState: true })
    console.log(`created admin ${email}`)
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1 }).finally(() => sequelize.close())
