const social = require('../service/social.service')
const { asyncHandler } = require('../utils/handlers')

const ok = (res, message, extra = {}, status = 200) => res.status(status).json({ success: true, message, ...extra })

const getRandomPosts = asyncHandler(async (req, res) => res.status(200).json(await social.latestPosts(req.user, req.query)))
const getFollowingPosts = asyncHandler(async (req, res) => res.status(200).json(await social.followingPosts(req.user, req.query)))
const getMyPosts = asyncHandler(async (req, res) => res.status(200).json(await social.postsOf(req.query.userId || req.user.id, req.user, req.query)))
const getMyLikedPosts = asyncHandler(async (req, res) => res.status(200).json(await social.likedPosts(req.query.userId || req.user.id, req.user, req.query)))
const getSavedPost = asyncHandler(async (req, res) => ok(res, 'Saved posts', { savedPosts: await social.savedPosts(req.user, req.query) }))
const getPostDetails = asyncHandler(async (req, res) => res.status(200).json(await social.postDetails(req.query.postId, req.user)))
const getLikes = asyncHandler(async (req, res) => res.status(200).json(await social.usersWhoLiked(req.query.postId)))
const getComments = asyncHandler(async (req, res) => res.status(200).json(await social.commentsFor(req.query.postId)))
const getMyComments = asyncHandler(async (req, res) => res.status(200).json(await social.myComments(req.user)))
const getViews = asyncHandler(async (req, res) => res.status(200).json(await social.usersWhoViewed(req.body.postId || req.query.postId)))

const createPost = asyncHandler(async (req, res) => {
  const post = await social.createPost(req.user, { body: req.body.body, files: req.files || [] })
  ok(res, 'Post created', { post }, 201)
})
const likePost = asyncHandler(async (req, res) => ok(res, 'Success', await social.toggleLike(req.user, req.body.postId)))
const commentOnPost = asyncHandler(async (req, res) => ok(res, 'Comment added', { comment: await social.addComment(req.user, req.body.postId, req.body.comment) }, 201))
const addToView = asyncHandler(async (req, res) => { await social.addView(req.user, req.body.postId); ok(res, 'View added') })
const deletePost = asyncHandler(async (req, res) => { await social.deletePost(req.user, req.query.postId); ok(res, 'Post deleted') })
const deleteComment = asyncHandler(async (req, res) => { await social.deleteComment(req.user, req.query.commentId); ok(res, 'Comment deleted') })
const updatePost = asyncHandler(async (req, res) => ok(res, 'Post updated', { post: await social.updatePost(req.user, req.body.postId, req.body.postUpdate) }))
const editComment = asyncHandler(async (req, res) => ok(res, 'Comment updated', { comment: await social.editComment(req.user, req.query.commentId, req.body.description) }))
const savePost = asyncHandler(async (req, res) => {
  const result = await social.toggleSave(req.user, req.query.postId)
  ok(res, result.saved ? 'Saved Post' : 'Unsaved Post', result)
})

module.exports = {
  getRandomPosts, getFollowingPosts, getMyPosts, getMyLikedPosts, getSavedPost, getPostDetails, getLikes, getComments, getMyComments,
  getViews, createPost, likePost, commentOnPost, addToView, deletePost, deleteComment, updatePost, editComment, savePost
}
