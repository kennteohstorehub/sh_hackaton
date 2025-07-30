#!/usr/bin/env node

const io = require('socket.io-client');

const socket = io('http://localhost:3838', {
    reconnection: false
});

socket.on('connect', () => {
    console.log('✅ Connected to Socket.IO');
    socket.disconnect();
    process.exit(0);
});

socket.on('connect_error', (error) => {
    console.error('❌ Connection error:', error.type, error.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('❌ Connection timeout');
    process.exit(1);
}, 5000);