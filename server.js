// server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve your HTML file (you can change this to your filename)
app.use(express.static(__dirname));

const users = {}; // Will track: { username: { speed, altitude, coords, socketId } }

const allowedUsers = ['zezo', 'layan', 'asser'];

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', ({ username }) => {
        if (!allowedUsers.includes(username)) {
            console.log('Unknown user tried to join:', username);
            return;
        }
        users[username] = { socketId: socket.id, speed: 0, altitude: 0, coords: null };
        console.log(username + ' joined');
        io.emit('updateUsers', users);
    });

    socket.on('locationUpdate', ({ username, speed, altitude, coords }) => {
        if (users[username]) {
            users[username].speed = speed;
            users[username].altitude = altitude;
            users[username].coords = coords;
            io.emit('updateUsers', users);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const user = Object.keys(users).find(u => users[u].socketId === socket.id);
        if (user) {
            delete users[user];
            io.emit('updateUsers', users);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server running on port', PORT));
