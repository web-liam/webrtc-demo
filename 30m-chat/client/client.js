const btnConnect = document.querySelector('button#connect')
const btnLeave = document.querySelector('button#leave')
const inputArea = document.querySelector('textarea#input')
const btnSend = document.querySelector('button#send')
const btnLinkP2p = document.querySelector('button#linkP2p')

let socket;
let room;
let username;

const peers = {}; // 存储每个连接的 peer
const links = {}; // 存储每个连接的 peer
const dataChannels = {}; // 存储每个连接的 channel

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
    if (username != data.to) return;
    //TODO：如果要群聊，需要判断是否已经存在连接，然后进行链接
    const usList = document.querySelector('div#linkUsers');
    usList.innerHTML += `<p>From:${data.from}, key:${data.id} ,to:${data.to} </p>`
  })

  socket.on('message', (room, data) => {
    const outputArea = document.querySelector('textarea#output')
    outputArea.scrollTop = outputArea.scrollHeight //窗口总是显示最后的内容
    outputArea.value = outputArea.value + data + '\r'
  })

  // 接收offer创建answer转发
  socket.on(SOCKET_ON_RTC.OFFER, async (data) => {
    const {offer,user} = data
    console.log(`on-OFFER.接收到offer`, offer,user)
    if (username != user.to) return;
    remoteConnection(socket,data)
  })

    // 接收answer
    socket.on(SOCKET_ON_RTC.ANSWER, async (data) => {
      const {answer,user} = data;
      console.log(`on-ANSWER.接收到answer`, answer,user)
      if (username != user.from) return;
      // 完善本地remote描述
      let id = user.id
      await peers[id].setRemoteDescription(answer)
    })

    // candidate回调
    socket.on(SOCKET_ON_RTC.CANDIDATE, async ({ pc, candidate ,user}) => {
      console.log(`on-CANDIDATE:接收到${pc}-candidate`, candidate)
      if (username != user.to && username != user.from) return;
      // 添加ice
      if (candidate){
        let id = user.id
        await peers[id].addIceCandidate(candidate)
      }
    })

}

btnSend.onclick = () => {
  var data = inputArea.value
  data = username + ':' + data
  let sendDB = { 'type': "chat", 'data': data, "key":"" }
  // socket.emit('message', room, data)
  for (let key in dataChannels) {
    let db = sendDB
    db.key = key
    db = JSON.stringify(db)
    console.log('btnSend-key:',key)
    dataChannels[key].send(db)
  }
  inputArea.value = ''
}

btnLeave.onclick = () => {
  socket.emit('leave', room, username)
}

btnLinkP2p.onclick = () => {
  let toUser = document.querySelector('input#linkuser').value
  let linkInfo = {"from":username, "to":toUser , "room":room, "id":createID()}
  localConnection(socket,linkInfo)
  socket.emit(SOCKET_EMIT.LINK_USER, linkInfo.room, linkInfo)
}

// 本地连接处理
function localConnection(socket,linkInfo) {
  let peer = initConnection(linkInfo);
  // openDataChannel(peer, username,receiveMessage)
  sendOffer(socket,peer,linkInfo)
}

// 远程连接处理
function remoteConnection(socket,data) {
  const {offer,user} = data;
  let peer = initConnection(user);
  sendAnswer(socket,peer,data)
}

function initConnection(linkInfo){
  let peerId = linkInfo.id
  let peer = newPeerConn();
  peers[peerId] = peer;
  links[peerId] = linkInfo;
  peer.onicecandidate = (event) => {
    console.log('sendAnswer.peer:onicecandidate')
    onicecandidateEvent(event,socket,linkInfo,'remote')
  }
  const ch = createDataChannel(peer, "chat",null,null)
  dataChannels[peerId] = ch;
  // ondatachannel
  peer.ondatachannel = (event) => {
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
        // remoteFileChannel.onmessage = handleFileReceiveMessage //(e) => console.log(`File onmessage: ${e.data}`);// handleReceiveFileMessage;
        remoteFileChannel.onopen = () => console.log('File channel (remote) is open.');
        remoteFileChannel.onclose = () => console.log('File channel (remote) is closed.');
    }
  }
  return peer;
}

async function handleChatReceiveMessage(event) {
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
  }else if (db.type === CHAT_TYPE.OPEN_VIDEO) {
    console.log('[INFO] handleChatReceiveMessage OPEN_VIDEO:', db.data)
    //await initVideoChat() //video
    //peConnAddTrack(localPc,localStream) //video
    //ontrackEvent(localPc, remoteVideo) //video
  }
  const outputArea = document.querySelector('textarea#output')
  outputArea.scrollTop = outputArea.scrollHeight //窗口总是显示最后的内容
  outputArea.value = outputArea.value + data + '\r'
}

// create ID
function createID() {
  let tt = Math.floor(Date.now());
  let rr = (Math.floor(Math.random() * 9000) + 1000);
  return tt+""+rr;
}

console.log('client.js loaded:-250108-1619');
