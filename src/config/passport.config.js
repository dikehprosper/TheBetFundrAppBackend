const passport = require('passport')
const { Strategy: LocalStrategy } = require('passport-local')
const bcrypt = require('bcryptjs')
const userRepository = require('../repositories/user.repository')

// Credential check only. Business rules (deactivated, PIN not set) live in auth.service,
// because the mobile app depends on distinct error codes for each case.
passport.use(
  new LocalStrategy({ usernameField: 'email', passwordField: 'password', session: false }, async (email, password, done) => {
    try {
      const user = await userRepository.findByEmail(email)
      if (!user) return done(null, false, { code: 501, message: 'User does not exists' })
      // the app expects "deactivated" to win over "wrong password" (original order)
      if (!user.isActivated) return done(null, false, { code: 502, message: 'User is deactivated' })
      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) return done(null, false, { code: 503, message: 'Invalid password' })
      return done(null, user)
    } catch (error) {
      return done(error)
    }
  })
)

module.exports = passport
