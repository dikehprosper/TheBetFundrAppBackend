const router = require('express').Router()
const c = require('../controllers/action.controller')
const { validate, schemas } = require('../middlewares/validate.middleware')

router.get('/follow', validate(schemas.userIdQuery), c.getFollowers)
router.put('/follow', validate(schemas.follow), c.followUser)
router.get('/data', validate(schemas.userIdQuery), c.getUserData)
router.patch('/token', validate(schemas.pushToken), c.updatePushToken)

module.exports = router
