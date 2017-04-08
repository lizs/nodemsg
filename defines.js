'use strict'

const NetError = Object.freeze({
    Success: 0,
    NE_Write: 1,
    NE_Read: 2,
    NE_SerialConflict: 3,
    NE_NoHandler: 4,
    NE_ReadErrorNo: 5,
    NE_SessionClosed: 6,
    NE_End: 7,
})

const Pattern = Object.freeze({
    Push: 0,
    Request: 1,
    Response: 2,
    Ping: 3,
    Pong: 4,
})

const HeaderSize = 2
const PatternSize = 1
const SerialSize = 2
const ErrorNoSize = 2
const MaxPackageSize = 32

module.exports = {
    NetError: NetError,
    Pattern: Pattern,
    HeaderSize: HeaderSize,
    PatternSize: PatternSize,
    SerialSize: SerialSize,
    ErrorNoSize: ErrorNoSize,
    MaxPackageSize: MaxPackageSize,
}