import { Server as IOServer } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initSocket(httpServer) {
  io = new IOServer(httpServer, { cors: { origin: '*' } });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      console.log("payload",payload);
      console.log("token",token);
      socket.user = payload;
      next();
    } catch (err) {
      console.error("Socket token verification failed:", err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join:auction', (auctionId) => socket.join(`auction:${auctionId}`));
    socket.on('leave:auction', (auctionId) => socket.leave(`auction:${auctionId}`));
  });
}

export function getIO() {
  if (!io) throw new Error('Socket not initialised');
  return io;
}
