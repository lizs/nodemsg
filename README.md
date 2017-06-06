nodemsg
======================
mom组件(https://git.oschina.net/lizs4ever/MOM.git)的Node实现

##Getting started
```C#
   // 定义handler
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
        }
    }   

   // 服务器
   let server = new tcpServer("localhost", 5002, new MyHandler())
   server.start()
   // 客户端
   let client = new tcpClient("localhost", 5002, new MyHandler())
   client.start()
```

##Question
QQ group ：http://jq.qq.com/?_wv=1027&k=VptNja
<br>e-mail : lizs4ever@163.com
