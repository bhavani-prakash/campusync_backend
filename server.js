require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');

// Connect Database
connectDB();

const server = http.createServer(app);

// Initialize Socket.IO with flexible CORS configuration
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Attach Chat Sockets Handler
const { initChatSockets } = require('./sockets/chatSocket');
initChatSockets(io);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`=================================================`);
  console.log(` CampusSync Server running on http://${HOST}:${PORT}`);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================================`);
});

// Handle unhandled rejection / uncaught exception
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
});
