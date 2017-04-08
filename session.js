'use strict'
const packer = require('./packer.js')
const defines = require('./defines.js')

const NetError = defines.NetError
const HeaderSize = defines.HeaderSize
const SerialSize = defines.SerialSize
const ErrorNoSize = defines.ErrorNoSize
const MaxPackageSize = defines.MaxPackageSize
const PatternSize = defines.PatternSize
const Pattern = defines.Pattern

var session = class Session {
    constructor(socket, id) {
        this.id = id
        this.socket = socket
        this.socket.setNoDelay(true)

        this.requestPool = {}
        this.serialSeed = 0

        this.bodyLen = 0
        this.offset = 0
        this.headerFilled = 0
        this.header = Buffer.allocUnsafe(HeaderSize).fill(0);

        this.handler = null
    }

    close() {
        this.socket.destroy()
        console.log('session closed.')
    }

    request(message, cb) {
        // 分配序列号
        let seirial = ++this.serialSeed

        // 插入请求池
        if (this.requestPool[serial]) {
            if (cb) {
                cb(NetError.NE_SerialConflict, null)
            }

            return
        }

        this.requestPool[serial] = cb

        // 发送
        this._send_with_serial(Pattern.Request, serial, (success) => {
            if (!success) {
                this.requestPool[serial] = null
                if (cb) {
                    cb(false, null)
                }
            }
        })
    }

    push(message, cb) {
        this._send(Pattern.Push, message, cb)
    }

    onPush(message) {
        this.handler.onPush(this, message)
    }

    onRequest(message, cb) {
        this.handler.onRequest(this, message, (en, respMsg) => {
            cb(en, respMsg)
        })
    }

    _pong() {
        this._send(Pattern.Pong);
    }

    _onEnd() {
        this.close()
    }

    _onData(chunk) {
        if (!this._pack(chunk)) {
            this.close()
        }
    }

    _onError(err) {
        console.log(err);
    }

    _onPush(message) {
        this.onPush(message)
    }

    _onPing(message) {
        this._pong()
    }

    _onPong(message) {
    }

    _onRequest(message) {
        let serial = message.readUInt16LE()

        let self = this
        let msg = message.slice(SerialSize)

        this.onRequest(msg, (en, respMsg) => {
            self._response(en, serial, respMsg)
        });
    }

    _response(en, serial, respMsg) {
        this._send_with_serial_en(Pattern.Response, serial, en, respMsg);
    }

    _onResponse(message) {
        // 读序列号
        let serial = message.readUInt16LE()
        let cb = this.requestPool[serial]
        if (!cb) {
            console.write("response serial %d not found", serial);
            return;
        }

        // 错误码
        let en = message.readUInt16LE(SerialSize)

        // 回调
        let msg = message.slice(SerialSize + ErrorNoSize)
        cb(en, msg)

        // 清除
        this.requestPool[serial] = null
    }

    _onMessage(raw) {
        //console.log("read : ", raw);
        let pattern = raw.readUInt8()
        let message = raw.slice(PatternSize)
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

    _send_imp(buf, cb) {
        //console.log("send : ", buf);
        this.socket.write(buf, (err) => {
            if (err) {
                console.log(err)
                if (cb) {
                    cb(NE_Write)
                }
            } else {
                if (cb) {
                    cb(Success)
                }
            }
        })
    }

    _send_with_serial_en(pattern, serial, en, message, cb) {
        let size = PatternSize + SerialSize + ErrorNoSize
        if (message) {
            size += message.length
        }

        let buf = Buffer.allocUnsafe(size + HeaderSize).fill(0)
        buf.writeUInt16LE(size)
        buf.writeUInt8(pattern, HeaderSize)
        buf.writeUInt16LE(serial, HeaderSize + PatternSize)
        buf.writeUInt16LE(en, HeaderSize + PatternSize + SerialSize)
        if (message) {
            message.copy(buf, HeaderSize + PatternSize + SerialSize + ErrorNoSize, 0, message.length)
        }

        this._send_imp(buf, cb)
    }

    _send_with_serial(pattern, serial, message, cb) {
        let size = PatternSize + SerialSize
        if (message) {
            size += message.length
        }

        let buf = Buffer.allocUnsafe(size + HeaderSize).fill(0)
        buf.writeUInt16LE(size)
        buf.writeUInt8(pattern, HeaderSize)
        buf.writeUInt8(serial, HeaderSize + PatternSize)
        if (message) {
            message.copy(buf, HeaderSize + PatternSize + SerialSize, 0, message.length)
        }

        this._send_imp(buf, cb)
    }

    _send(pattern, message, cb) {
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

        this._send_imp(buf, cb)
    }

    _pack(chunk, window = { offset: 0 }) {
        if (chunk.length === window.offset) {
            return true;
        }

        if (this._packFinished()) {
            this.bodyLen = 0
            this.offset = 0
            this.headerFilled = 0
            this.header.fill(0)

            this._onMessage(this.buf)
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
        wind.offset += size;
    }
}

module.exports = session