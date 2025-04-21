const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Optimize for Vercel environment
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
  maxHttpBufferSize: 1e8, // 100MB
  path: '/socket.io/'
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

// Alumni (host) route
app.get('/alumni/host', (req, res) => {
  const roomId = req.query.room || Math.random().toString(36).substring(2, 7);
  const webinarId = req.query.webinar || '';
  res.render('alumni-host', { roomId, webinarId });
});

// Student (viewer) route
app.get('/student/view', (req, res) => {
  const roomId = req.query.room || '';
  const webinarId = req.query.webinar || '';
  res.render('student-view', { roomId, webinarId });
});

// Keep existing routes for backward compatibility
app.get('/host', (req, res) => {
  const roomId = req.query.room || '';
  const webinarId = req.query.webinar || '';
  res.render('host', { roomId, webinarId });
});

app.get('/view', (req, res) => {
  const roomId = req.query.room || '';
  const webinarId = req.query.webinar || '';
  res.render('view', { roomId, webinarId });
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');

  // Host creates a room
  socket.on('create-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Host created room: ${roomId}`);
  });

  // Viewer joins a room
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    console.log(`Viewer joined room: ${roomId}`);
    socket.to(roomId).emit('viewer-joined', socket.id);
  });

  // WebRTC signaling
  socket.on('offer', (offer, roomId, targetId) => {
    if (targetId) {
      socket.to(targetId).emit('offer', offer, socket.id);
    } else {
      socket.to(roomId).emit('offer', offer, socket.id);
    }
  });

  socket.on('answer', (answer, targetId) => {
    socket.to(targetId).emit('answer', answer, socket.id);
  });

  socket.on('ice-candidate', (candidate, targetId) => {
    socket.to(targetId).emit('ice-candidate', candidate, socket.id);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    if (socket.roomId) {
      socket.to(socket.roomId).emit('user-disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));