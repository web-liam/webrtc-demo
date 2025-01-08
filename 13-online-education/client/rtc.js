
const rtcConfig = {
    iceServers: [
      {
        urls: ["stun:stun.l.google.com:19302"]
      },
      {
        urls: ["turn:wangxiang.website:3478"],
        username: "admin",
        credential: "admin"
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
    /** 链接某人 */
    LINK_USER: 'linkuser',
  };


  const CHAT_TYPE = {
    CHAT: 'chat', // 聊天
    FILE_TRANSFER: 'fileTransfer', // 文件开始传输
    FINISH_FILE: 'finishTransfer', // 文件完成传输信息
    OPEN_VIDEO: 'openVideo', // 打开视频
  }

function creatPeerConn() {
    return new RTCPeerConnection(rtcConfig)
}

// candidate事件
function onicecandidateCb(event,socket,pc,user)  {
    console.log('[INFO]onicecandidate:'+pc, event.candidate)
    // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
    if (event.candidate)
      socket.emit(SOCKET_ON_RTC.CANDIDATE, user.room, {
        pc: pc,//'local',
        candidate: event.candidate,
        user:user,
      })
  }

const sendOffer = async (socket,localPc,user) => {
    console.log("[INFO]sendOffer:",user)
    // 发起方：创建offer(成功将offer的设置当前流，并发送给接收方)
    let offer = await localPc.createOffer()
    // 建立连接，此时就会触发onicecandidate，然后注册ontrack
    await localPc.setLocalDescription(offer)
    socket.emit(SOCKET_ON_RTC.OFFER, room, {"offer":offer,"user":user})
  }

  const sendAnswer = async (socket,localPc,data) => {
    const {offer,user} = data;
    console.log("[INFO]sendAnswer",offer,user)
    await localPc.setRemoteDescription(offer)
    const answer = await localPc.createAnswer()
    await localPc.setLocalDescription(answer)
    socket.emit(SOCKET_ON_RTC.ANSWER, room, {answer,user})
  }

  // 创建datachannel
  function createDataChannel(localConnection,chName,onopenCb, oncloseCb) {
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
    // channel.onmessage = (event) => {
    //   console.log('[INFO] createDataChannel onmessage:',event.data)
    // }
    return channel
  }

  // 发送消息:ty chat/fileTransfer
  function chatSendData(ch,ty,data){
    const db = { 'type': ty, 'data': data }
    ch?.send(JSON.stringify(db))
  }

  console.log('[INFO] rtc.js loaded 250107-1537')