const router = require('express').Router()
const c = require('../controllers/auth.controller')
const { validate, schemas } = require('../middlewares/validate.middleware')
const { authLimiter, authSlowDown, publicMoneyLimiter } = require('../middlewares/rateLimit.middleware')
const { featureFlag } = require('../middlewares/flags.middleware')

// PUBLIC routes: no token needed, so every one is rate limited.
router.post('/register', featureFlag('CUSTOM_SIGNUP'), authLimiter, validate(schemas.register), c.register)
router.post('/login', featureFlag('CUSTOM_LOGIN'), authLimiter, authSlowDown, validate(schemas.login), c.login)
router.post('/resetPassword', featureFlag('FORGOT_PASSWORD'), authLimiter, validate(schemas.emailOnly), c.resetPassword)
router.post('/checkPin2', authLimiter, validate(schemas.checkResetCode), c.checkPin2)
router.post('/resetPasswordForLoggedInUser2', featureFlag('RESET_PASSWORD'), authLimiter, validate(schemas.resetPasswordWithCode), c.resetPasswordWithCode)

router.post('/checkQRCodeValidity', authLimiter, validate(schemas.qrCheck), c.checkQRCodeValidity)
router.get('/getQRCode', authLimiter, c.getQRCode)
router.post('/noLogindeposit', featureFlag('DEPOSITS'), publicMoneyLimiter, validate(schemas.qrDeposit), c.noLoginDeposit)
router.post('/deposit2', featureFlag('DEPOSITS'), publicMoneyLimiter, validate(schemas.publicDeposit), c.publicDeposit)
router.post('/deposit', validate(schemas.qosCallback), c.qosCallback) // provider callback, secret-protected
router.get('/requestAddress', c.requestAddress)

module.exports = router
