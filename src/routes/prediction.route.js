const router = require('express').Router()
const c = require('../controllers/prediction.controller')
const { validate, schemas } = require('../middlewares/validate.middleware')
const { requireAdmin } = require('../middlewares/role.middleware')
const { imageUpload } = require('../middlewares/upload.middleware')

// reads: any signed-in user
router.post('/getLeague', c.getLeague)
router.post('/getTeam', c.getTeam)
router.get('/getAllMatchPrediction', c.first.list)
router.get('/getAllMatchPrediction2', c.second.list)

// writes: admins only (the old API let any signed-in user create and delete)
router.post('/createLeague', requireAdmin, imageUpload.single('image'), validate(schemas.league), c.createLeague)
router.post('/createTeam', requireAdmin, imageUpload.single('image'), validate(schemas.team), c.createTeam)
router.post('/deleteLeague', requireAdmin, validate(schemas.idBody), c.deleteLeague)
router.post('/deleteTeam', requireAdmin, validate(schemas.idBody), c.deleteTeam)
router.post('/createMatchPrediction', requireAdmin, validate(schemas.match), c.first.create)
router.post('/createMatchPrediction2', requireAdmin, validate(schemas.match), c.second.create)
router.post('/updateMatchPrediction', requireAdmin, validate(schemas.matchUpdate), c.first.update)
router.post('/updateMatchPrediction2', requireAdmin, validate(schemas.matchUpdate), c.second.update)
router.post('/deleteMatchPrediction', requireAdmin, validate(schemas.idBody), c.first.remove)
router.post('/deleteMatchPrediction2', requireAdmin, validate(schemas.idBody), c.second.remove)

module.exports = router
