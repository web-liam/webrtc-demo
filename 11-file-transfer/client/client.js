const btnConnect = document.querySelector('button#connect')
const btnLeave = document.querySelector('button#leave')
const inputArea = document.querySelector('textarea#input')
const btnSend = document.querySelector('button#send')
const btnLinkP2p = document.querySelector('button#linkP2p')

// file
const fileInput = document.getElementById('fileInput');
const sendFileButton = document.getElementById('sendFile');
const downloadLink = document.getElementById('downloadLink');

let socket
let room
let username
let localPc ;
let chatChannel ; // 聊天通道
let fileChannel ; // 文件通道

btnConnect.onclick = () => {
  room = document.querySelector('input#room').value
  username = document.querySelector('input#username').value
  let server = document.querySelector('input#wsServer').value
  console.log('server:',server) // http://localhost:3338
  // 连接server 携带username和room
  socket = io(server,{
    path: '/rtc', //rtc
    query: { username, room },
  }).connect()

  // 断开连接了
  socket.on(SOCKET_ON_SYS.DISCONNECT, () => {
    btnConnect.disabled = false
    btnLeave.disabled = true
    inputArea.disabled = true
    btnSend.disabled = true
  })

  socket.on(SOCKET_EMIT.SYS_USER_LIST, (userList) => {
    console.log('当前房间用户列表', userList)
    btnConnect.disabled = true
    btnLeave.disabled = false
    inputArea.disabled = false
    btnSend.disabled = false
    const usList = document.querySelector('div#users')
    usList.innerHTML = ''
    for (let user of userList) {
      usList.innerHTML += `<p>用户名:${user.username} 房间:${user.room}, SID:${user.sid} </p>`
    }
  })

  socket.on(SOCKET_EMIT.LEAVE, (room, user) => {
    console.log(`${user}从房间${room}离开`)
    btnConnect.disabled = false
    btnLeave.disabled = true
    inputArea.disabled = true
    btnSend.disabled = true
    socket.disconnect()
  })

  socket.on(SOCKET_EMIT.LINK_USER, (room, data) => {
    console.log(`请求链接消息:来自于房间 ${room}, data: `,data)// {from: 'user1', to: 'user2'}
  })

  socket.on('message', (room, data) => {
    const outputArea = document.querySelector('textarea#output')
    outputArea.scrollTop = outputArea.scrollHeight //窗口总是显示最后的内容
    outputArea.value = outputArea.value + data + '\r'
  })

  // 接收offer创建answer转发
    socket.on(SOCKET_ON_RTC.OFFER, async (data) => {
      console.log(`on-OFFER.接收到offer`, data)
      remoteConnection(socket,data)
    })

    // 接收answer
    socket.on(SOCKET_ON_RTC.ANSWER, async (data) => {
      const {answer,user} = data;
      console.log(`on-ANSWER.接收到answer`, answer,user)
      if (username != user.from) return;
      // 完善本地remote描述
      await localPc.setRemoteDescription(answer)
    })

    // candidate回调
    socket.on(SOCKET_ON_RTC.CANDIDATE, async (data) => {
      const { pc, candidate ,user} = data;
      console.log(`on-CANDIDATE:接收到${pc}-candidate`, candidate)
      if (username != user.to && username != user.from) return;
      // 回调显示
      // if (!remoteVideoRef.value) return
      // let video = remoteVideoRef.value.$el
      // localPc.ontrack = (e) => {
      //   video.srcObject = e.streams[0]
      //   video.oncanplay = () => video.play()
      // }
      // 添加ice
      await localPc.addIceCandidate(candidate)
    })

}

// 本地连接处理
function localConnection(socket,user) {
  console.log(`on-OFFER.发起offer`, user)
  localPc = creatPeerConn()
  localPc.onicecandidate = (event) => {
    onicecandidateCb(event,socket,"local",user)
  }
  chatChannel = createDataChannel(localPc, "chat",null, null)
  fileChannel = createDataChannel(localPc, "file",null, null)
  // ondatachannel
  localPc.ondatachannel = (event) => {
    const label = event.channel.label
    console.log("[INFO] ondatachannel-label:",label)
    console.log("[INFO] ondatachannel-event:",event)
    if (label === 'chat') {
        const remoteChatChannel = event.channel;
        remoteChatChannel.onmessage = handleChatReceiveMessage //(e) => log(`Chat onmessage: ${e.data}`);
        remoteChatChannel.onopen = () => console.log('Chat channel (remote) is open.');
        remoteChatChannel.onclose = () => console.log('Chat channel (remote) is closed.');
    } else if (label === 'file') {
        const remoteFileChannel = event.channel;
        remoteFileChannel.onmessage = handleFileReceiveMessage //(e) => console.log(`File onmessage: ${e.data}`);// handleReceiveFileMessage;
        remoteFileChannel.onopen = () => console.log('File channel (remote) is open.');
        remoteFileChannel.onclose = () => console.log('File channel (remote) is closed.');
    }
  }
  // sendOffer
  sendOffer(socket,localPc,user)
}

// 远程连接处理
function remoteConnection(socket,data) {
  const {offer,user} = data;
  console.log(`on-OFFER.接收到offer,发Answer`, offer,user)
  if (username != user.to) return;
  if (username != user.to) return;
  localPc = creatPeerConn()
  localPc.onicecandidate = (event) => {
    console.log('sendAnswer.localPc:onicecandidate')
    onicecandidateCb(event,socket,"remote",user)
  }
  chatChannel = createDataChannel(localPc, "chat",null, null)
  fileChannel = createDataChannel(localPc, "file",null, null)
  // ondatachannel
  localPc.ondatachannel = (event) => {
    const label = event.channel.label
    console.log("[INFO] ondatachannel-label:",label)
    console.log("[INFO] ondatachannel-event:",event)
    if (label === 'chat') {
        const remoteChatChannel = event.channel;
        remoteChatChannel.onmessage = handleChatReceiveMessage //(e) => log(`Chat onmessage: ${e.data}`);
        remoteChatChannel.onopen = () => console.log('Chat channel (remote) is open.');
        remoteChatChannel.onclose = () => console.log('Chat channel (remote) is closed.');
    } else if (label === 'file') {
        const remoteFileChannel = event.channel;
        remoteFileChannel.onmessage = handleFileReceiveMessage //(e) => console.log(`File onmessage: ${e.data}`);// handleReceiveFileMessage;
        remoteFileChannel.onopen = () => console.log('File channel (remote) is open.');
        remoteFileChannel.onclose = () => console.log('File channel (remote) is closed.');
    }
  }
  // sendAnswer
  sendAnswer(socket,localPc,data)
}

btnSend.onclick = () => {
  var data = inputArea.value
  data = username + ':' + data
  // socket.emit('message', room, data)
  // chatChannel?.send(data)
  chatSendData(chatChannel,'chat',data)
  inputArea.value = ''
}

btnLeave.onclick = () => {
  socket.emit('leave', room, username)
}

btnLinkP2p.onclick = () => {
  let toUser = document.querySelector('input#linkuser').value
  if (!toUser || toUser == username) {
    alert('请输入对方用户名')
    return
  }
  let user = {"from":username, "to":toUser,"room":room}
  socket.emit('linkuser', room, user)

  localConnection(socket,user)
}

function handleChatReceiveMessage(event) {
  let data = event.data
  console.log('[INFO] handleChatReceiveMessage:', data)
  let db = JSON.parse(data)
  if (db.type === CHAT_TYPE.CHAT) {
    console.log('[INFO] handleChatReceiveMessage chat:', db.data)
  } else if (db.type === CHAT_TYPE.FILE_TRANSFER) {
    console.log('[INFO] handleChatReceiveMessage file:', db.data)
    receivedFileName = db.data.name;
    receivedFileSize = db.data.size;
  }else if (db.type === CHAT_TYPE.FINISH_FILE) {
    console.log('[INFO] handleChatReceiveMessage FINISH_FILE:', db.data)
  }
  const outputArea = document.querySelector('textarea#output')
  outputArea.scrollTop = outputArea.scrollHeight //窗口总是显示最后的内容
  outputArea.value = outputArea.value + data + '\r'
}

// file
sendFileButton.onclick = () => {
  const file = fileInput.files[0];
    if (!file) {
        log('No file selected.');
        return;
    }
    const filemsg = { 'state':0, 'name': file.name, 'size': file.size };
    chatSendData(chatChannel,CHAT_TYPE.FILE_TRANSFER, filemsg);
    // send file
    const chunkSize = 16 * 1024; // 16 KB chunks
    const fileReader = new FileReader();
    let offset = 0;
    fileReader.onload = (event) => {
        fileChannel.send(event.target.result);
        offset += event.target.result.byteLength;
        console.log(`Sent ${offset} bytes.`);
        if (offset < file.size) {
            readSlice(offset);
        } else {
            log('[send]File transfer completed:'+file.name);
        }
    };
    const readSlice = (o) => {
        const slice = file.slice(o, o + chunkSize);
        fileReader.readAsArrayBuffer(slice);
    };
    readSlice(0);
}

downloadLink.onclick = () => {
  
}
const log = (message) => {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML += `<p>${message}</p>`;
};


// Handle Messages
let receivedBuffer = [];
let receivedSize = 0;
let receivedFileName = '';
let receivedFileSize = 0;
function handleFileReceiveMessage(event) {
    receivedBuffer.push(event.data);
    receivedSize += event.data.byteLength;
    console.log(`Received ${receivedSize} bytes.`);
    if (receivedSize === receivedFileSize) {
        const receivedBlob = new Blob(receivedBuffer);
        downloadLink.href = URL.createObjectURL(receivedBlob);
        downloadLink.download = receivedFileName ;//fileInput.files[0].name;
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Download File';
        log('[Received]File transfer completed:'+receivedFileName);
        // Reset.
        receivedBuffer = [];
        receivedSize = 0;
        receivedFileSize = 0;
    }
}


console.log('[INFO] client.js loaded 250107-1154')