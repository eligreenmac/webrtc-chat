const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Socket.IO setup with CORS
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Store connected peers
const peers = new Map(); // socketId -> { username, roomId }
const rooms = new Map(); // roomId -> Set of socketIds

// Main chat room (everyone joins by default)
const MAIN_ROOM = 'main';

io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] Client connected: ${socket.id}`);

    // Join main room by default
    socket.join(MAIN_ROOM);

    // Handle username registration
    socket.on('register', (data) => {
        const { username } = data;
        peers.set(socket.id, {
            id: socket.id,
            username: username || `User-${socket.id.substring(0, 4)}`
        });

        if (!rooms.has(MAIN_ROOM)) {
            rooms.set(MAIN_ROOM, new Set());
        }
        rooms.get(MAIN_ROOM).add(socket.id);

        console.log(`[${new Date().toISOString()}] User registered: ${username} (${socket.id})`);

        // Send current peer list to the new user
        const peerList = Array.from(rooms.get(MAIN_ROOM))
            .filter(id => id !== socket.id)
            .map(id => peers.get(id))
            .filter(Boolean);

        socket.emit('peers-list', peerList);

        // Notify others about the new peer
        socket.to(MAIN_ROOM).emit('peer-joined', peers.get(socket.id));
    });

    // Handle WebRTC signaling: offer
    socket.on('offer', (data) => {
        const { targetId, offer } = data;
        console.log(`[${new Date().toISOString()}] Offer from ${socket.id} to ${targetId}`);

        io.to(targetId).emit('offer', {
            fromId: socket.id,
            fromPeer: peers.get(socket.id),
            offer
        });
    });

    // Handle WebRTC signaling: answer
    socket.on('answer', (data) => {
        const { targetId, answer } = data;
        console.log(`[${new Date().toISOString()}] Answer from ${socket.id} to ${targetId}`);

        io.to(targetId).emit('answer', {
            fromId: socket.id,
            fromPeer: peers.get(socket.id),
            answer
        });
    });

    // Handle ICE candidates
    socket.on('ice-candidate', (data) => {
        const { targetId, candidate } = data;

        io.to(targetId).emit('ice-candidate', {
            fromId: socket.id,
            candidate
        });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] Client disconnected: ${socket.id}`);

        const peer = peers.get(socket.id);
        if (peer) {
            // Notify others
            socket.to(MAIN_ROOM).emit('peer-left', {
                id: socket.id,
                username: peer.username
            });
        }

        // Cleanup
        peers.delete(socket.id);
        if (rooms.has(MAIN_ROOM)) {
            rooms.get(MAIN_ROOM).delete(socket.id);
        }
    });

    // Heartbeat to detect connection issues
    socket.on('ping', () => {
        socket.emit('pong');
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  WebRTC Signaling Server');
    console.log('========================================');
    console.log(`  Server running on port ${PORT}`);
    console.log(`  Local:   http://localhost:${PORT}`);
    console.log('========================================');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
