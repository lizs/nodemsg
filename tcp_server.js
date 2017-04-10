'use strict'

const net = require('net');
const assert = require('assert')
const session = require('./session.js')
const sessionMgr = require('./session_mgr.js')
var defaultHandler = require('./session_handler.js')

let tcpServer = class TcpServer {
    constructor(host, port, handler = new defaultHandler()) {
        this.host = host
        this.port = port
        this.server = null
        this.sessionMgr = new sessionMgr()
        this.handler = handler
    }

    start() {
        this.server = net.createServer((socket) => {
            socket.on('end', () => {
                socket.session._onEnd()
            })

            socket.on('data', (chunk) => {
                socket.session._onData(chunk)
            })

            socket.on('error', (err) => {
                socket.session._onError(err)
            })
        })

        let self = this
        let server = this.server
        server.ref()

        server.on('connection', (socket) => {
            let session = self.sessionMgr.makeSession(socket)
            session.handler = self.handler
            self.handler.onOpen(session)
        })

        server.on('error', (err) => {
            console.log(err)
            server.close()
        })

        server.listen(this.port, this.host, () => {
            console.log('server is running on :', server.address())
        })
    }

    stop() {
        let server = this.server
        if (server) {
            server.close(() => {
                console.log('server stopped')
                server.unref()
            })
        }
    }
}

module.exports = tcpServer