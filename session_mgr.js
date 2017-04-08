'use strict'
const Session = require('./session.js')

var sessionMgr = class SessionMgr {
    constructor() {
        this.session_id_seed = 0
        this.sessions = {}
    }

    makeSession(socket) {
        let id = ++this.session_id_seed
        let session = new Session(socket, id)
        socket.session = session
        this.sessions[id] = session

        return session
    }

    close(id) {
        let session = this.sessions[id]
        this.remove(id)

        if (session) {
            session.close()
        }
    }

    remove(id) {
        this.sessions[id] = null
    }
}

module.exports = sessionMgr