

// url = "ws://localhost:3337/ws-rtc?room=1"
function WebSocketClient(url) {
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
        switch (data.type) {
            case "userlist":
                handleOffer(data.offer, data.sender);
                break;
            case "offer":
                handleOffer(data.offer, data.sender);
                break;
            case "answer":
                handleAnswer(data.answer, data.sender);
                break;
            case "candidate":
                handleCandidate(data.candidate, data.sender);
                break;
            case "new-peer":
                createPeerConnection(data.sender);
                break;
        }
    };
    // 通知服务器有新用户加入
    // socket.send(JSON.stringify({ type: "join" }));
}

// 通知服务器有新用户加入
function newUser(socket,uid, room) {
    let data = { "type": "join", "data": {"uid":uid,"room":room}, "room": room  };
    socket.send(JSON.stringify(data));
}
