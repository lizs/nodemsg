'use strict'

let tcpServer = require("./tcp_server.js")
let tcpClient = require("./tcp_client.js")

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function main(arg) {
    // if (!arg || arg.length == 0) {
    //     rl.question('输入启动参数(server/client) : ', (answer) => {
    //         setImmediate(main, answer)
    //     });

    //     return
    // }

    switch (arg) {
        case 'client': {
            let client = new tcpClient("127.0.0.1", 5002)
            client.start()
            break
        }

        case 'server': {
            let server = new tcpServer("127.0.0.1", 5002)
            server.start()
            break
        }

        default:
            let server = new tcpServer("127.0.0.1", 5002)
            server.start()
            break
    }
}

let arg = process.argv.splice(2)
main(arg)
