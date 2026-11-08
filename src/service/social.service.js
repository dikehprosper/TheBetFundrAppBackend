const { Op } = require('sequelize')
const { sequelize, Post, PostMedia, PostLike, PostView, PostSave, Comment, Follow, User } = require('../models')
const { userRepository } = require('../repositories')
const providers = require('./providers')
const { prepareImage, assertImageAllowed } = require('./image.service')
const { createSocialNotification } = require('./notification.service')
const { toPublicProfile } = require('../utils/helpers/dto.helper')
const { AppError } = require('../utils/handlers')

const MAX_MEDIA = 10
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime'])
const clampLimit = (value, fallback = 50) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), 100)

/** Attach author, media, likes, views, comment counts and the viewer's own save flag to posts. */
async function hydrate (posts, viewerId) {
  if (!posts.length) return []
  const ids = posts.map((p) => p.id)
  const [authors, media, likes, views, saves, commentCounts] = await Promise.all([
    userRepository.findManyByIds([...new Set(posts.map((p) => p.userId))]),
    PostMedia.findAll({ where: { postId: { [Op.in]: ids } }, order: [['position', 'ASC']] }),
    PostLike.findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['postId', 'userId'] }),
    PostView.findAll({ where: { postId: { [Op.in]: ids } }, attributes: ['postId', 'userId'] }),
    viewerId ? PostSave.findAll({ where: { postId: { [Op.in]: ids }, userId: viewerId }, attributes: ['postId', 'userId'] }) : [],
    Comment.count({ where: { postId: { [Op.in]: ids } }, group: ['postId'] })
  ])
  const byPost = (rows) => rows.reduce((acc, row) => { (acc[row.postId] = acc[row.postId] || []).push(row); return acc }, {})
  const mediaBy = byPost(media)
  const likesBy = byPost(likes)
  const viewsBy = byPost(views)
  const savesBy = byPost(saves)
  const authorMap = new Map(authors.map((a) => [a.id, a]))
  const commentMap = new Map(commentCounts.map((c) => [c.postId, Number(c.count)]))

  return posts.map((post) => {
    const author = authorMap.get(post.userId)
    return {
      _id: post.id,
      id: post.id,
      user: author ? toPublicProfile(author) : null,
      body: post.body,
      media: (mediaBy[post.id] || []).map((m) => ({ url: m.url, type: m.type })),
      likes: (likesBy[post.id] || []).map((l) => l.userId),
      views: (viewsBy[post.id] || []).map((v) => v.userId),
      saves: (savesBy[post.id] || []).map((s) => s.userId), // only the viewer's own save is ever exposed
      likeCount: (likesBy[post.id] || []).length,
      viewCount: (viewsBy[post.id] || []).length,
      commentCount: commentMap.get(post.id) || 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt
    }
  })
}

async function storeMedia (file) {
  if (VIDEO_TYPES.has(file.mimetype)) {
    const saved = await providers.storage.save({ buffer: file.buffer, originalName: file.originalname || 'video.mp4', contentType: file.mimetype, folder: 'posts' })
    return { url: saved.url, type: 'video', fileName: saved.fileName }
  }
  const buffer = await prepareImage(file.buffer, { width: 1280, height: 1280, fit: 'inside' })
  await assertImageAllowed(buffer)
  const saved = await providers.storage.save({ buffer, originalName: 'post.webp', contentType: 'image/webp', folder: 'posts' })
  return { url: saved.url, type: 'image', fileName: saved.fileName }
}

async function createPost (user, { body, files = [] }) {
  if (!body && files.length === 0) throw new AppError(400, 'A post needs text or media')
  if (files.length > MAX_MEDIA) throw new AppError(400, `At most ${MAX_MEDIA} files per post`)
  // process uploads first so nothing is written to the database if a file is rejected
  const stored = []
  try {
    for (const file of files) stored.push(await storeMedia(file))
  } catch (error) {
    await Promise.all(stored.map((s) => providers.storage.remove(s.fileName)))
    throw error
  }
  const post = await sequelize.transaction(async (t) => {
    const created = await Post.create({ userId: user.id, body: body || null }, { transaction: t })
    if (stored.length) {
      await PostMedia.bulkCreate(stored.map((s, i) => ({ postId: created.id, url: s.url, type: s.type, position: i })), { transaction: t })
    }
    return created
  })
  return (await hydrate([post], user.id))[0]
}

const feed = async (where, viewerId, { limit, offset } = {}) =>
  hydrate(await Post.findAll({ where, order: [['createdAt', 'DESC']], limit: clampLimit(limit), offset: Math.max(parseInt(offset, 10) || 0, 0) }), viewerId)

const latestPosts = (viewer, page) => feed({}, viewer.id, page)
const postsOf = (userId, viewer, page) => feed({ userId }, viewer.id, page)

async function followingPosts (viewer, page) {
  const follows = await Follow.findAll({ where: { followerId: viewer.id }, attributes: ['followingId'] })
  const ids = follows.map((f) => f.followingId)
  if (!ids.length) return []
  return feed({ userId: { [Op.in]: ids } }, viewer.id, page)
}

async function likedPosts (userId, viewer, page) {
  const likes = await PostLike.findAll({ where: { userId }, attributes: ['postId'] })
  if (!likes.length) return []
  return feed({ id: { [Op.in]: likes.map((l) => l.postId) } }, viewer.id, page)
}

async function savedPosts (viewer, page) {
  const saves = await PostSave.findAll({ where: { userId: viewer.id }, attributes: ['postId'] })
  if (!saves.length) return []
  return feed({ id: { [Op.in]: saves.map((s) => s.postId) } }, viewer.id, page)
}

async function requirePost (postId) {
  const post = await Post.findByPk(postId)
  if (!post) throw new AppError(404, 'Post not found')
  return post
}

async function postDetails (postId, viewer) {
  return (await hydrate([await requirePost(postId)], viewer.id))[0]
}

async function updatePost (user, postId, body) {
  const post = await requirePost(postId)
  if (post.userId !== user.id) throw new AppError(403, 'You can only edit your own posts')
  await post.update({ body })
  return (await hydrate([post], user.id))[0]
}

async function deletePost (user, postId) {
  const post = await requirePost(postId)
  if (post.userId !== user.id && user.role !== 'admin') throw new AppError(403, 'You can only delete your own posts')
  const media = await PostMedia.findAll({ where: { postId } })
  await post.destroy() // media, likes, views, saves and comments cascade in the database
  await Promise.all(media.map((m) => providers.storage.remove(m.url.split('/uploads/')[1] || m.url.split('.com/')[1] || '')))
}

async function toggleLike (user, postId) {
  const post = await requirePost(postId)
  const existing = await PostLike.findOne({ where: { postId, userId: user.id } })
  if (existing) {
    await existing.destroy()
    return { liked: false }
  }
  await PostLike.create({ postId, userId: user.id })
  createSocialNotification({ fromUserId: user.id, toUserId: post.userId, type: 'like', description: `${user.fullname} liked your post`, postId }).catch(() => {})
  return { liked: true }
}

async function toggleSave (user, postId) {
  await requirePost(postId)
  const existing = await PostSave.findOne({ where: { postId, userId: user.id } })
  if (existing) {
    await existing.destroy()
    return { saved: false }
  }
  await PostSave.create({ postId, userId: user.id })
  return { saved: true }
}

/** Idempotent: a second view by the same user changes nothing. */
async function addView (user, postId) {
  await requirePost(postId)
  await PostView.findOrCreate({ where: { postId, userId: user.id }, defaults: { postId, userId: user.id } })
}

async function addComment (user, postId, description) {
  const post = await requirePost(postId)
  const comment = await Comment.create({ postId, userId: user.id, description })
  createSocialNotification({ fromUserId: user.id, toUserId: post.userId, type: 'comment', description: `${user.fullname} commented on your post`, postId }).catch(() => {})
  return commentDto(comment, user)
}

const commentDto = (comment, author) => ({
  _id: comment.id, id: comment.id, postId: comment.postId, description: comment.description,
  user: author ? toPublicProfile(author) : null, createdAt: comment.createdAt, updatedAt: comment.updatedAt
})

async function editComment (user, commentId, description) {
  const comment = await Comment.findByPk(commentId)
  if (!comment) throw new AppError(404, 'Comment not found')
  if (comment.userId !== user.id) throw new AppError(403, 'You can only edit your own comments')
  await comment.update({ description })
  return commentDto(comment, user)
}

async function deleteComment (user, commentId) {
  const comment = await Comment.findByPk(commentId)
  if (!comment) throw new AppError(404, 'Comment not found')
  const post = await Post.findByPk(comment.postId)
  if (comment.userId !== user.id && !(post && post.userId === user.id) && user.role !== 'admin') {
    throw new AppError(403, 'You cannot delete this comment')
  }
  await comment.destroy()
}

async function commentsFor (postId) {
  await requirePost(postId)
  const comments = await Comment.findAll({ where: { postId }, order: [['createdAt', 'ASC']] })
  const authors = new Map((await userRepository.findManyByIds([...new Set(comments.map((c) => c.userId))])).map((u) => [u.id, u]))
  return comments.map((c) => commentDto(c, authors.get(c.userId)))
}

async function myComments (user) {
  const comments = await Comment.findAll({ where: { userId: user.id }, order: [['createdAt', 'DESC']], limit: 100 })
  const posts = await hydrate(await Post.findAll({ where: { id: { [Op.in]: comments.map((c) => c.postId) } } }), user.id)
  const postMap = new Map(posts.map((p) => [p.id, p]))
  return comments.map((c) => ({ ...commentDto(c, user), post: postMap.get(c.postId) || null }))
}

async function usersWhoLiked (postId) {
  await requirePost(postId)
  const likes = await PostLike.findAll({ where: { postId }, attributes: ['userId'] })
  return (await userRepository.findManyByIds(likes.map((l) => l.userId))).map(toPublicProfile)
}

async function usersWhoViewed (postId) {
  await requirePost(postId)
  const views = await PostView.findAll({ where: { postId }, attributes: ['userId'] })
  return (await userRepository.findManyByIds(views.map((v) => v.userId))).map(toPublicProfile)
}

module.exports = {
  createPost, latestPosts, postsOf, followingPosts, likedPosts, savedPosts, postDetails, updatePost, deletePost,
  toggleLike, toggleSave, addView, addComment, editComment, deleteComment, commentsFor, myComments,
  usersWhoLiked, usersWhoViewed, User
}
