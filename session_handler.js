'use strict'

const defines = require('./defines.js')
const NetError = defines.NetError

var handler = class SessionHandler {
    constructor() { }

    onPush(session, message) {
    }

    onRequest(session, message, cb) {
        cb(NetError.NE_NoHandler, null)
    }

    onClosed(session) {
        console.log('session ', session.id, ' closed')
    }

    onOpen(session) {
        console.log('session ', session.id, ' established')
    }
}

module.exports = handler