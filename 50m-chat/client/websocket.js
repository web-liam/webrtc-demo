

// url = "ws://localhost:3337/ws-rtc?room=1&uid=1"
function WebSocketClient(url,onmessage) {
    this.url = url;
    this.socket = null;
    // 连接 WebSocket 信令服务器
    const socket = new WebSocket(url);
    socket.onopen = () => {
        console.log("[INFO]已连接到信令服务器");
    };
    socket.onclose = () => {
        console.log("[INFO]已断开连接");
    };
    socket.onerror = (error) => {
        console.log("[ERROR]连接错误", error);
    }
    socket.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (onmessage){
            onmessage(data);
        }
    };
    return socket;
}

function sendWsMsg(socket,room,data,ty,uid) {
    let msg = { "type":ty, "data": data, "room": room , "sid":uid};
    socket.send(JSON.stringify(msg));
}


console.log('ws.js loaded:-250108-1619');
