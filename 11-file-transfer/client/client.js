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
let chatChannel ;

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
      const {offer,user} = data;
      console.log(`on-OFFER.接收到offer`, offer,user)
      if (username != user.to) return;
      localPc = creatPeerConn()
      localPc.onicecandidate = (event) => {
        console.log('sendAnswer.localPc:onicecandidate')
        onicecandidateCb(event,socket,"remote",user)
      }
      chatChannel = createDataChannel(localPc, "chat",null, null,receiveMessage)
      sendAnswer(socket,localPc,data)
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

btnSend.onclick = () => {
  var data = inputArea.value
  data = username + ':' + data
  // socket.emit('message', room, data)
  chatChannel?.send(data)
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
  localPc = creatPeerConn()
  let user = {"from":username, "to":toUser,"room":room}
  localPc.onicecandidate = (event) => {
    onicecandidateCb(event,socket,"local",user)
  }
  chatChannel = createDataChannel(localPc, "chat",null, null,receiveMessage)
  sendOffer(socket,localPc,user)
  socket.emit('linkuser', room, user)
}

function receiveMessage(data) {
  console.log('[INFO] receiveMessage:', data)
  const outputArea = document.querySelector('textarea#output')
  outputArea.scrollTop = outputArea.scrollHeight //窗口总是显示最后的内容
  outputArea.value = outputArea.value + data + '\r'
}

const log = (message) => {
  const logDiv = document.getElementById('log');
  logDiv.innerHTML += `<p>${message}</p>`;
};

console.log('[INFO] client.js loaded 170959')