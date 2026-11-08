const router = require('express').Router()
const c = require('../controllers/post.controller')
const { validate, schemas } = require('../middlewares/validate.middleware')
const { mediaUpload } = require('../middlewares/upload.middleware')
const { Joi } = require('../middlewares/validate.middleware')

const postIdQuery = { query: Joi.object({ postId: Joi.string().guid({ version: 'uuidv4' }).required() }) }

router.get('/', validate(schemas.page), c.getRandomPosts)
router.get('/my-posts', validate(schemas.userIdQuery), c.getMyPosts)
router.get('/liked-posts', validate(schemas.userIdQuery), c.getMyLikedPosts)
router.get('/following', validate(schemas.page), c.getFollowingPosts)
router.get('/like', validate(postIdQuery), c.getLikes)
router.get('/comment', validate(postIdQuery), c.getComments)
router.get('/view', validate(postIdQuery), c.getViews)
router.get('/details', validate(postIdQuery), c.getPostDetails)
router.get('/saved', validate(schemas.page), c.getSavedPost)
router.get('/my-comments', c.getMyComments)

router.post('/createPost', mediaUpload.array('images', 10), validate(schemas.postCreate), c.createPost)
router.post('/like', validate(schemas.postId), c.likePost)
router.post('/comment', validate(schemas.comment), c.commentOnPost)
router.post('/view', validate(schemas.postId), c.addToView)

router.delete('/', validate(postIdQuery), c.deletePost)
router.delete('/comment', validate(schemas.commentDelete), c.deleteComment)
router.patch('/', validate(schemas.postUpdate), c.updatePost)
router.patch('/comment', validate(schemas.commentEdit), c.editComment)
router.put('/saved', validate(postIdQuery), c.savePost)

module.exports = router
