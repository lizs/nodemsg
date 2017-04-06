'use strict'

const net = require('net');
const assert = require('assert')
const session = require('./session.js')
const packer = require('./packer.js')
const sessionMgr = require('./session_mgr.js')

global.g_sessionMgr = new sessionMgr()

const server = net.createServer((socket) => {
    socket.on('end', () => {
        socket.session._onEnd()
    });

    socket.on('data', (chunk) => {
        socket.session._onData(chunk)
    });

    socket.on('error', (err) => {
        socket.session._onError(err)
    });

    //socket.pipe(socket)
});

server.on('connection', (socket) => {
    g_sessionMgr.makeSession(socket)
});

server.on('error', (err) => {
    console.log(err);
    server.close()
});

server.listen(5002, 'localhost', () => {
    console.log('server is running on :', server.address());
});