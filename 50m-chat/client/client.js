const btnConnect = document.querySelector('button#connect')
const btnLeave = document.querySelector('button#leave')
const inputArea = document.querySelector('textarea#input')
const btnSend = document.querySelector('button#send')
const btnLinkP2p = document.querySelector('button#linkP2p')

let socket;
let room;
let username;
let uid;

const peers = {}; // 存储每个连接的 peer
const links = {}; // 存储每个连接的 peer
const dataChannels = {}; // 存储每个连接的 channel

btnConnect.onclick = () => {
  room = document.querySelector('input#room').value
  username = document.querySelector('input#username').value
  let server = document.querySelector('input#wsServer').value
  console.log('server:', server) // http://localhost:3338
  uid = username;
  let url = server + '?room=' + room + '&uid=' + username
  // 连接server 携带username和room "ws://localhost:3337/ws-rtc?room=1&uid=1"
  socket = WebSocketClient(url,onmessage);
}

function onmessage(db) {
  switch (db.type) {
    case SOCKET_EMIT.SYS_USER_LIST:
      handleUserList(db);
      break;
    case SOCKET_ON_RTC.OFFER:
      handleOffer(db);
      break;
    case SOCKET_ON_RTC.ANSWER:
      handleAnswer(db);
      break;
    case SOCKET_ON_RTC.CANDIDATE:
      handleCandidate(db);
      break;
    // case "new-peer":
    //   createPeerConnection(data.sender);
    //   break;
  }
}
// 通知服务器有新用户加入
function handleUserList(db) {
  let userList = db.data
  room = db.room
  console.log('[INFO]当前房间用户列表', userList)
  btnConnect.disabled = true
  btnLeave.disabled = false
  inputArea.disabled = false
  btnSend.disabled = false
  const usList = document.querySelector('div#users')
  usList.innerHTML = ''
  for (let user of userList) {
    usList.innerHTML += `<p>用户:${user} 房间:${room} </p>`
  }

}

function handleDisconnectWs(db) {
  console.log(`${username}从房间${room}离开`)
  btnConnect.disabled = false
  btnLeave.disabled = true
  inputArea.disabled = true
  btnSend.disabled = true
}

function handleOffer(db) {
  // console.log('handleOffer:')
  let data = db.data
  const { offer, user } = data
  if (username != user.to) return;
  console.log(`on-OFFER.接收到offer`, offer, user)
  remoteConnection(socket, data)
}

async function handleAnswer(db) {
  // console.log('handleAnswer:')
  const { answer, user } = db.data;
  if (username != user.from) return;
  console.log(`on-ANSWER.接收到answer`, answer, user)
  // 完善本地remote描述
  let id = user.id
  await peers[id].setRemoteDescription(answer)
}

async function handleCandidate(db) {
  console.log('handleCandidate:',db)
  const { candidate, user,pc } = db.data;
  if (username != user.to && username != user.from) return;
  if (db.sid==uid) return;//自己发的不处理
  console.log(`on-CANDIDATE:接收到${pc}-candidate`, candidate)
  // 添加ice
  let pid = user.id
  if (candidate && peers[pid]) {
    await peers[pid].addIceCandidate(candidate)
  }
}

function handleLinkuser(db) {
  console.log(`请求链接消息:来自于房间 ${room}, data: `, db)// {from: 'user1', to: 'user2'}
  let data = db.data;
  if (username != data.to) return;
  //TODO：如果要群聊，需要判断是否已经存在连接，然后进行链接
  const usList = document.querySelector('div#linkUsers');
  usList.innerHTML += `<p>From:${data.from}, key:${data.id} ,to:${data.to} </p>`
}

btnSend.onclick = () => {
  var data = inputArea.value
  data = username + ':' + data
  let sendDB = { 'type': "chat", 'data': data, "key": "" }
  // socket.emit('message', room, data)
  for (let key in dataChannels) {
    let db = sendDB
    db.key = key
    db = JSON.stringify(db)
    console.log('btnSend-key:', key)
    dataChannels[key].send(db)
  }
  inputArea.value = ''
}

btnLeave.onclick = () => {
  sendWsMsg(socket, room, username, SOCKET_EMIT.LEAVE, uid)
  // socket.emit('leave', room, username)
}

btnLinkP2p.onclick = () => {
  let toUser = document.querySelector('input#linkuser').value
  let linkInfo = { "from": username, "to": toUser, "room": room, "id": createID() }
  localConnection(socket, linkInfo)
  // socket.emit(SOCKET_EMIT.LINK_USER, linkInfo.room, linkInfo)
  sendWsMsg(socket, room, linkInfo, SOCKET_EMIT.LINK_USER, uid)
}

// 本地连接处理
function localConnection(socket, linkInfo) {
  let peer = initConnection(linkInfo, 'local');
  // openDataChannel(peer, username,receiveMessage)
  sendOffer(socket, peer, linkInfo)
}

// 远程连接处理
function remoteConnection(socket, data) {
  const { offer, user } = data;
  let peer = initConnection(user, 'remote');
  sendAnswer(socket, peer, data)
}

function initConnection(linkInfo,pc) {
  let peerId = linkInfo.id
  let peer = newPeerConn();
  peers[peerId] = peer;
  links[peerId] = linkInfo;
  peer.onicecandidate = (event) => {
    console.log('initConnection.peer:onicecandidate')
    onicecandidateEvent(event, socket, linkInfo, pc)
  }
  const ch = createDataChannel(peer, "chat", null, null)
  dataChannels[peerId] = ch;
  // ondatachannel
  peer.ondatachannel = (event) => {
    const label = event.channel.label
    console.log("[INFO] ondatachannel-label:", label)
    console.log("[INFO] ondatachannel-event:", event)
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
  } else if (db.type === CHAT_TYPE.FINISH_FILE) {
    console.log('[INFO] handleChatReceiveMessage FINISH_FILE:', db.data)
  } else if (db.type === CHAT_TYPE.OPEN_VIDEO) {
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
  return tt + "" + rr;
}

console.log('client.js loaded:-250108-1619');
