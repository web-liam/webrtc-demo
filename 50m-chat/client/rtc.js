
const rtcConfig = {
  iceServers: [
    {
      urls: ["stun:stun.l.google.com:19302"]
    }
  ]
};

const SOCKET_ON_RTC = {
  /** 建立连接 */
  CANDIDATE: 'candidate',
  /** 发起者发送offer */
  OFFER: 'offer',
  /** 接收者发送answer */
  ANSWER: 'answer',
};

const SOCKET_ON_SYS = {
  /** 连接socket */
  CONNECTION: 'connection',
  /** 断开socket */
  DISCONNECT: 'disconnect',
};

const SOCKET_EMIT = {
  /** 人数 */
  SYS_USER_LIST: 'userlist',
  /** 离开房间 */
  LEAVE: 'leave',
  /** 发送消息 */
  MESSAGE: 'message',
  /** 链接某人 */
  LINK_USER: 'linkuser',
};

const CHAT_TYPE = {
  CHAT: 'chat', // 聊天
  FILE_TRANSFER: 'fileTransfer', // 文件开始传输
  FINISH_FILE: 'finishTransfer', // 文件完成传输信息
  OPEN_VIDEO: 'openVideo', // 打开视频
}

function newPeerConn() {
  return new RTCPeerConnection(rtcConfig)
}

function onicecandidateEvent(event, socket, linkInfo, pc) {
  console.log('[INFO]onicecandidateEvent:' + pc, event.candidate, event)
  // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
  if (event.candidate)
    socket.emit(SOCKET_ON_RTC.CANDIDATE, linkInfo.room, {
      pc: pc,// 'local',
      candidate: event.candidate,
      user: linkInfo,
    })
}

const sendOffer = async (socket, peer, linkInfo) => {
  console.log("sendOffer:", linkInfo)
  // 发起方：创建offer(成功将offer的设置当前流，并发送给接收方)
  let offer = await peer.createOffer()
  // 建立连接，此时就会触发onicecandidate，然后注册ontrack
  await peer.setLocalDescription(offer)
  let room = linkInfo.room;
  socket.emit(SOCKET_ON_RTC.OFFER, room, { "offer": offer, "user": linkInfo })
}

const sendAnswer = async (socket, peer, data) => {
  const { offer, user } = data
  console.log("sendAnswer", offer, user)
  await peer.setRemoteDescription(offer)
  const answer = await peer.createAnswer()
  await peer.setLocalDescription(answer)
  let room = user.room;
  socket.emit(SOCKET_ON_RTC.ANSWER, room, {"answer":answer,"user":user})
}

// 创建datachannel
function createDataChannel(localConnection, chName, onopenCb, oncloseCb) {
  channel = localConnection.createDataChannel(chName)
  channel.onopen = () => {
    console.log('[INFO] createDataChannel data channel is open')
    if (onopenCb) {
      onopenCb()
    }
  }
  channel.onclose = () => {
    console.log('[INFO] createDataChannel data channel onclose:')
    if (oncloseCb) {
      oncloseCb()
    }
  }
  return channel
}