const { sequelize, Sequelize } = require('../config/database.config')
const User = require('./User')
const PlatformSettings = require('./PlatformSettings')
const UserBetId = require('./UserBetId')
const AccountDeletionRequest = require('./AccountDeletionRequest')
const QrCodeDeposit = require('./QrCodeDeposit')
const Transaction = require('./Transaction')
const LedgerEntry = require('./LedgerEntry')
const PaymentEvent = require('./PaymentEvent')
const Follow = require('./Follow')
const Post = require('./Post')
const PostMedia = require('./PostMedia')
const PostLike = require('./PostLike')
const PostView = require('./PostView')
const PostSave = require('./PostSave')
const Comment = require('./Comment')
const Notification = require('./Notification')
const PredictionLeague = require('./PredictionLeague')
const PredictionTeam = require('./PredictionTeam')
const MatchPrediction = require('./MatchPrediction')
const ApiCache = require('./ApiCache')

// Associations. Constraints already exist in the migrations, so none are created here.
const noConstraints = { constraints: false }

User.hasMany(User, { as: 'referrals', foreignKey: 'referrerId', ...noConstraints })
User.belongsTo(User, { as: 'referrer', foreignKey: 'referrerId', ...noConstraints })
User.hasMany(UserBetId, { as: 'betIds', foreignKey: 'userId', ...noConstraints })
User.hasMany(Transaction, { as: 'transactions', foreignKey: 'userId', ...noConstraints })
Transaction.belongsTo(User, { as: 'user', foreignKey: 'userId', ...noConstraints })
Transaction.belongsTo(User, { as: 'counterparty', foreignKey: 'counterpartyId', ...noConstraints })
Transaction.hasMany(LedgerEntry, { as: 'ledgerEntries', foreignKey: 'transactionId', ...noConstraints })
QrCodeDeposit.belongsTo(User, { as: 'user', foreignKey: 'userId', ...noConstraints })

User.belongsToMany(User, { as: 'following', through: Follow, foreignKey: 'followerId', otherKey: 'followingId', ...noConstraints })
User.belongsToMany(User, { as: 'followers', through: Follow, foreignKey: 'followingId', otherKey: 'followerId', ...noConstraints })

Post.belongsTo(User, { as: 'author', foreignKey: 'userId', ...noConstraints })
Post.hasMany(PostMedia, { as: 'media', foreignKey: 'postId', ...noConstraints })
Post.hasMany(PostLike, { as: 'likes', foreignKey: 'postId', ...noConstraints })
Post.hasMany(PostView, { as: 'views', foreignKey: 'postId', ...noConstraints })
Post.hasMany(PostSave, { as: 'saves', foreignKey: 'postId', ...noConstraints })
Post.hasMany(Comment, { as: 'comments', foreignKey: 'postId', ...noConstraints })
Comment.belongsTo(User, { as: 'author', foreignKey: 'userId', ...noConstraints })
Comment.belongsTo(Post, { as: 'post', foreignKey: 'postId', ...noConstraints })
Notification.belongsTo(User, { as: 'fromUser', foreignKey: 'fromUserId', ...noConstraints })
Notification.belongsTo(Post, { as: 'post', foreignKey: 'postId', ...noConstraints })

module.exports = {
  sequelize,
  Sequelize,
  User,
  PlatformSettings,
  UserBetId,
  AccountDeletionRequest,
  QrCodeDeposit,
  Transaction,
  LedgerEntry,
  PaymentEvent,
  Follow,
  Post,
  PostMedia,
  PostLike,
  PostView,
  PostSave,
  Comment,
  Notification,
  PredictionLeague,
  PredictionTeam,
  MatchPrediction,
  ApiCache
}
