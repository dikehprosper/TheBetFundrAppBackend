const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const logger = require('./logger.config')

let io = null

function init (httpServer, allowedOrigins) {
  io = new Server(httpServer, { cors: { origin: allowedOrigins, methods: ['GET', 'POST'] } })

  // Only authenticated clients may connect, and each joins only its own room.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token
      const payload = jwt.verify(token, process.env.ACCESS_TOKEN_PRIVATE_KEY, {
        algorithms: [process.env.ACCESS_TOKEN_ALGORITHM || 'HS256']
      })
      socket.data.userId = payload.id
      next()
    } catch (_error) {
      next(new Error('unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`)
    logger.debug({ userId: socket.data.userId }, 'socket connected')
  })
  return io
}

/** Push a realtime event to one user. No-op when sockets are not running (tests, scripts). */
function emitToUser (userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload)
}

module.exports = { init, emitToUser }
