'use strict'
const defines = require('./defines.js')

const NetError = defines.NetError
const HeaderSize = defines.HeaderSize
const PackCountSize = defines.PackageCountSize
const SerialSize = defines.SerialSize
const ErrorNoSize = defines.ErrorNoSize
const MaxBodySize = defines.MaxPackageSize
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

        this.slices = []

        this.handler = null
    }

    // 关闭
    close() {
        this.socket.destroy()
        console.log('session closed.')
    }

    // 请求
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
        this._send(Pattern.Request, serial, null, message, (success) => {
            if (!success) {
                this.requestPool[serial] = null
                if (cb) {
                    cb(false, null)
                }
            }
        })
    }

    // 推送
    push(message, cb) {
        this._send(Pattern.Push, null, null, message, cb)
    }

    // 处理推送
    onPush(message) {
        this.handler.onPush(this, message)
    }

    // 处理请求
    onRequest(message, cb) {
        this.handler.onRequest(this, message, (en, respMsg) => {
            cb(en, respMsg)
        })
    }

    // Pong
    _pong() {
        this._send(Pattern.Pong);
    }

    // 处理结束
    _onEnd() {
        this.close()
    }

    // 处理socket数据
    _onData(chunk) {
        if (!this._extract(chunk)) {
            this.close()
        }
    }

    // 处理错误
    _onError(err) {
        console.log(err);
    }

    // 处理推送
    _onPush(message) {
        this.onPush(message)
    }

    // 处理Ping
    _onPing(message) {
        this._pong()
    }

    // 处理Pong
    _onPong(message) {
    }

    // 处理请求
    _onRequest(message) {
        let serial = message.readUInt16LE()

        let self = this
        let msg = message.slice(SerialSize)

        this.onRequest(msg, (en, respMsg) => {
            self._response(en, serial, respMsg)
        });
    }

    // 处理响应
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

    // 处理消息
    _onMessage(raw) {
        let cnt = raw.readUInt8()
        if (cnt < 1) {
            this.close()
            return
        }

        let slice = raw.slice(PackCountSize, raw.length - PackCountSize)
        this.slices.push(slice)

        if (cnt == 1) {
            // 组包
            let totalLen = 0;
            for (let i = 0; i < this.slices.length; ++i) {
                totalLen += this.slices[i].length
            }

            var message = Buffer.alloc(totalLen, 0)

            let offset = 0
            for (let i = 0; i < this.slices.length; ++i) {
                this.slices[i].copy(message, offset, 0, this.slices[i].length)
                offset += this.slices[i].length
            }

            // 清空slices
            this.slices = []
            
            // 派发
            this._dispatch(message)
        }
    }

    // 派发消息
    _dispatch(raw) {
        let pattern = raw.readUInt8()
        let msg = raw.slice(PatternSize)
        switch (pattern) {
            case Pattern.Push:
                this._onPush(msg)
                break
            case Pattern.Request:
                this._onRequest(msg)
                break
            case Pattern.Response:
                this._onResponse(msg)
                break
            case Pattern.Ping:
                this._onPing(msg)
                break
            case Pattern.Pong:
                this._onPong(msg)
                break
        }
    }

    // 响应
    _response(en, serial, respMsg) {
        this._send(Pattern.Response, serial, en, respMsg);
    }

    // socket 写
    _send_imp(buf, cb) {
        //console.log("send : ", buf);
        this.socket.write(buf, (err) => {
            if (err) {
                console.log(err)
                if (cb) {
                    cb(NetError.NE_Write)
                }
            } else {
                if (cb) {
                    cb(NetError.Success)
                }
            }
        })
    }

    // 写
    _send(pattern, serial, en, message, cb) {
        let buffers = this._pack_write(pattern, serial, en, message)

        let left = buffers.length
        let finished = true
        for (let i = 0; i < buffers.length; ++i) {
            this._send_imp(buffers[i], (success) => {
                --left
                finished &= success
                if (left == 0) {
                    if (cb)
                        cb(finished)
                }
            })
        }
    }

    // 写数据打包
    _pack_write(pattern, serial, en, message) {
        let size = PackCountSize + PatternSize

        if (serial || serial == 0) {
            size += SerialSize
        }

        if (en || en == 0) {
            size += ErrorNoSize
        }

        if (message) {
            size += message.length
        }

        // 构造buf
        let buf = Buffer.allocUnsafe(size).fill(0)
        let offset = 0

        buf.writeUInt8(pattern, offset) // Pattern
        offset += PatternSize

        if (serial || serial == 0) {
            buf.writeUInt16LE(serial, offset)   // serial
            offset += SerialSize
        }

        if (en || en == 0) {
            buf.writeUInt16LE(en, offset)    // error number
            offset += ErrorNoSize
        }

        if (message) {
            message.copy(buf, offset, 0, message.length)
        }

        // 拆分
        let lastLen = size % MaxBodySize
        let cnt = (size - lastLen) / MaxBodySize
        if (lastLen != 0)
            ++cnt;

        let buffers = new Array()
        for (let i = 0; i < cnt; ++i) {
            let bodyLen = MaxBodySize
            if (i == cnt - 1 && lastLen != 0) {
                bodyLen = lastLen
            }

            let slice = Buffer.allocUnsafe(bodyLen + PackCountSize + HeaderSize).fill(0)
            let offset = 0

            slice.writeUInt16LE(bodyLen + PackCountSize, offset)
            offset += HeaderSize

            slice.writeUInt8(cnt - i, offset)
            offset += PackCountSize

            buf.copy(slice, offset, i * MaxBodySize, bodyLen)

            // 添加
            buffers.push(slice)
        }

        return buffers;
    }

    // 提取数据包
    _extract(chunk, window = { offset: 0 }) {
        if (this._extractFinished()) {
            this.bodyLen = 0
            this.offset = 0
            this.headerFilled = 0
            this.header.fill(0)

            this._onMessage(this.buf)
        }

        if (chunk.length === window.offset) {
            return true;
        }

        if (this.bodyLen !== 0) {
            this._extractBody(chunk, window);
            return this._extract(chunk, window)
        }
        else {
            this._packWriteHeader(chunk, window)
            if (!this._extractHeader(chunk)) {
                return false;
            }

            return this._extract(chunk, window)
        }
    }

    // 提取数据包头
    _extractHeader(chunk) {
        if (this.headerFilled === HeaderSize) {
            this.bodyLen = this.header.readUInt16LE(0)
            if (this.bodyLen === 0) {
                console.error("Invalid package len  : ", this.bodyLen)
                return false
            }

            if (this.bodyLen > MaxBodySize) {
                console.error("Package much tool huge : ", this.bodyLen, ", bigger than ", MaxBodySize)
                return false
            }

            this._resetExtractor(this.bodyLen)
        }

        return true;
    }

    // 提取是否已结束
    _extractFinished() {
        return this.buf != null && this.offset === this.buf.length;
    }

    // 充值提取器
    _resetExtractor(size) {
        this.buf = Buffer.allocUnsafe(size).fill(0)
        this.offset = 0
    }

    _extractBody(buffer, wind) {
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