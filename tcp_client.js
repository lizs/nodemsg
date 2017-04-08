'use strict'

const net = require('net');
const Session = require('./session.js')
var defaultHandler = require('./session_handler.js')

let tcpClient = class TcpClient {
    constructor(host, port, handler = new defaultHandler()) {
        this.host = host
        this.port = port
        this.autoReconnectEnabled = true
        this.handler = handler
    }

    start() {
        let self = this
        self.socket = new net.Socket()
        let session = new Session(self.socket, 0)
        session.handler = this.handler
        self.socket.session = session

        let socket = self.socket
        socket.on('end', () => {
            socket.session._onEnd()
        })

        socket.on('data', (chunk) => {
            socket.session._onData(chunk)
        })

        socket.on('error', (err) => {
            socket.session._onError(err)
        })

        socket.on('connect', (err) => {
            self.handler.onOpen(session)
        })

        socket.on('close', (err) => {
            self.handler.onClose(session)
            if (self.autoReconnectEnabled) {
                setTimeout(() => {
                    self.start()
                }, 2000)
            }
        })

        socket.connect(this.port, this.host)
    }

    stop() {
        if (this.socket) {
            this.socket.close()
        }
    }
}

module.exports = tcpClient