'use strict'

const HeaderSize = 2;
const MaxPackageSize = 32;

var packer = class Packer {
    constructor() {
        this.bodyLen = 0;
        this.offset = 0;

        this.headerFilled = 0;
        this.header = Buffer.allocUnsafe(HeaderSize).fill(0);
    }

    pack(chunk, window = { offset: 0 }) {
        if (chunk.length === window.offset) {
            return true;
        }

        // package headerExtracted ?
        if (this.finished()) {
            this.bodyLen = 0
            this.offset = 0
            this.headerFilled = 0
            this.header.fill(0)

            //console.log("Extracted : ", this.buf.toString('ascii'));
        }

        if (this.bodyLen !== 0) {
            this.write(chunk, window);

            return this.pack(chunk, window)
        }
        else {
            this.writeHeader(chunk, window)

            if (!this.packHeader(chunk)) {
                return false;
            }

            return this.pack(chunk, window)
        }

        return true;
    }

    packHeader(chunk) {
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

            this.reset(this.bodyLen)
        }

        return true;
    }

    finished() {
        return this.buf != null && this.offset === this.buf.length;
    }

    reset(size) {
        this.buf = Buffer.allocUnsafe(size).fill(0)
        this.offset = 0
    }

    write(buffer, window) {
        let size = Math.min(buffer.length - window.offset, this.buf.length - this.offset)
        buffer.copy(this.buf, this.offset, window.offset, window.offset + size)
        this.offset += size;
        window.offset += size;
    }

    writeHeader(buffer, window) {
        let size = Math.min(buffer.length, this.header.length - this.headerFilled)
        buffer.copy(this.header, this.headerFilled, window.offset, window.offset + size)
        this.headerFilled += size
        window.offset += HeaderSize;
    }
}

module.exports = packer