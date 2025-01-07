
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

function creatPeerConn() {
    return new RTCPeerConnection(rtcConfig)
}

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
  function createDataChannel(localConnection,chName,onopenCb, oncloseCb,receiveMessageCb) {
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
    localConnection.ondatachannel = (event) => {
      // 成功拿到 RTCDataChannel
      const dataChannel = event.channel
      dataChannel.onmessage = (event) => {//receiveMessage(event.data)
        console.log("[INFO] createDataChannel onmessage:",event.data)
        if (receiveMessageCb) {
          receiveMessageCb(event.data)
        }
      }
    }
    return channel
  }

  console.log('[INFO] rtc.js loaded 170959')