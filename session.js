'use strict'
const packer = require('./packer.js')
const events = require('events')

const HeaderSize = 2;
const MaxPackageSize = 32;

const PatternSize = 1;
const Pattern = {
    Push: 0,
    Request: 1,
    Response: 2,
    Ping: 3,
    Pong: 4,
}

const PatternName = [
    'Push',
    'Request',
    'Response',
    'Ping',
    'Pong',
]

var session = class Session{
    constructor(socket, smgr, id){
        this.id = id
        this.socket = socket
        this.sessionMgr = smgr
        this.emitter = new events.EventEmitter()
        
        this.bodyLen = 0;
        this.offset = 0;
        this.headerFilled = 0;
        this.header = Buffer.allocUnsafe(HeaderSize).fill(0);
    }

    close() {
        this.socket.destroy()
        console.log('session closed.');
    }

    request(message, cb) {

    }

    push(message) {
        this._send(Pattern.Push, message)
    }

    _send(pattern, message) {
        let size = PatternSize
        if (message) {
            size += message.length
        }

        let buf = Buffer.allocUnsafe(size + HeaderSize).fill(0)
        buf.writeUInt16LE(size)
        buf.writeUInt8(pattern, HeaderSize)
        if (message) {
            message.copy(buf, HeaderSize + PatternSize, 0, message.length)
        }

        this.socket.write(buf, (err) => {
            if (err) {
                console.log(err)
            }
        })
    }

    _pong(){
        this._send(Pattern.Pong);
    }

    _onEnd() {
        this.close()
    }

    _onData(chunk){
        if (!this._pack(chunk)) {
            this.destroy()
        }
    }

    _onError(err) {
        console.log(err);
    }

    _onPush(message){
        this.push(message)
    }

    _onPing(message){
        this._pong()
    }

    _onPong(message){

    }

    _onMessage(raw) {
        let pattern = raw.readUInt8()
        let message = raw.slice(PatternSize)
        console.log(PatternName[pattern], ' : ', message.toString('ascii'))
        switch (pattern) {
            case Pattern.Push:
                this._onPush(message)
                break
            case Pattern.Request:
                this._onRequest(message)
                break
            case Pattern.Response:
                this._onResponse(message)
                break
            case Pattern.Ping:
                this._onPing(message)
                break
            case Pattern.Pong:
                this._onPong(message)
                break
        }
    }

    _pack(chunk, window = { offset: 0 }) {
        if (chunk.length === window.offset) {
            return true;
        }

        // package headerExtracted ?
        if (this._packFinished()) {
            this.bodyLen = 0
            this.offset = 0
            this.headerFilled = 0
            this.header.fill(0)

            this._onMessage(this.buf)
            //console.log("Extracted : ", this.buf.toString('ascii'));
        }

        if (this.bodyLen !== 0) {
            this._packWrite(chunk, window);

            return this._pack(chunk, window)
        }
        else {
            this._packWriteHeader(chunk, window)

            if (!this._packHeader(chunk)) {
                return false;
            }

            return this._pack(chunk, window)
        }

        return true;
    }

    _packHeader(chunk) {
        if (this.headerFilled === HeaderSize) {
            this.bodyLen = this.header.readUInt16LE(0)
            if (this.bodyLen === 0) {
                console.error("Invalid package len  : ", this.bodyLen)
                return false
            }

            if (this.bodyLen > MaxPackageSize) {
                console.error("Package much tool huge : ", this.bodyLen, ", bigger than ", MaxPackageSize)
                return false
            }

            this._resetPacker(this.bodyLen)
        }

        return true;
    }

    _packFinished() {
        return this.buf != null && this.offset === this.buf.length;
    }

    _resetPacker(size) {
        this.buf = Buffer.allocUnsafe(size).fill(0)
        this.offset = 0
    }

    _packWrite(buffer, wind) {
        let size = Math.min(buffer.length - wind.offset, this.buf.length - this.offset)
        buffer.copy(this.buf, this.offset, wind.offset, wind.offset + size)
        this.offset += size;
        wind.offset += size;
    }

    _packWriteHeader(buffer, wind) {
        let size = Math.min(buffer.length, this.header.length - this.headerFilled)
        buffer.copy(this.header, this.headerFilled, wind.offset, wind.offset + size)
        this.headerFilled += size
        wind.offset += HeaderSize;
    }
}

module.exports = session