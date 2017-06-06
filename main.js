'use strict'

let tcpServer = require("./tcp_server.js")
let tcpClient = require("./tcp_client.js")
const defines = require('./defines.js')
const NetError = defines.NetError

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

class MyHandler {
    constructor() { }

    onPush(session, message) {
    }

    onRequest(session, message, cb) {
        cb(NetError.Success, null)
    }

    onClose(session) {
        console.log('session ', session.id, ' closed')
    }

    onOpen(session) {
        console.log('session ', session.id, ' established')
        this._request(session)
    }

    _request(session){   
        let self = this;     
        session.request(Buffer.alloc(20).fill(0), (err, message)=>{
            self._request(session)
        })
    }
}

function main(arg) {
    if (!arg || arg.length == 0) {
        rl.question('输入启动参数(server/client) : ', (answer) => {
            setImmediate(main, answer)
        });

        return
    }

    switch (arg) {
        case 'client': {
            let client = new tcpClient("localhost", 5002)
            client.start()
            break
        }

        case 'server': {
            let server = new tcpServer("localhost", 5002, new MyHandler())
            server.start()
            break
        }

        default:
            // let server = new tcpServer("localhost", 5002, new MyHandler())
            // server.start()
            let client = new tcpClient("localhost", 5002, new MyHandler())
            client.start()
            break
    }
}

let arg = process.argv.splice(2)
main(arg)
