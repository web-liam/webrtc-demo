
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

function getlocalPc() {
    return new RTCPeerConnection(rtcConfig)
}

function onicecandidateSendOffer(event,socket,room,user)  {
    console.log('[INFO]onicecandidateSendOffer:', event.candidate, event)
    // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
    if (event.candidate)
      socket.emit(SOCKET_ON_RTC.CANDIDATE, room, {
        pc: 'local',
        candidate: event.candidate,
        user:user,
      })
  }

  function  onicecandidateSendAnswer (event,socket,room,user) {
    console.log('[INFO] onicecandidateSendAnswer:', event.candidate, event)
    // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
    if (event.candidate)
      socket.emit(SOCKET_ON_RTC.CANDIDATE, room, {
        pc: 'remote',
        candidate: event.candidate,
        user:user,
      })
  }

const sendOffer = async (socket,localPc,user) => {
    console.log("sendOffer:",user)
    // 初始化当前视频
    // let localPc = new RTCPeerConnection(rtcConfig)
    // openDataChannel(localPc, username)
    // // 添加RTC流
    // localStream.getTracks().forEach((track) => {
    //   localPc.addTrack(track, localStream)
    // })
    // 给当前RTC流设置监听事件(协议完成回调)
    // localPc.onicecandidate = (event) => {
    //   console.log('sendOffer.localPc:', event.candidate, event)
    //   // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
    //   if (event.candidate)
    //     socket.emit(SOCKET_ON_RTC.CANDIDATE, room, {
    //       pc: 'local',
    //       candidate: event.candidate,
    //     })
    // }
    // 发起方：创建offer(成功将offer的设置当前流，并发送给接收方)
    let offer = await localPc.createOffer()
    // 建立连接，此时就会触发onicecandidate，然后注册ontrack
    await localPc.setLocalDescription(offer)
    socket.emit(SOCKET_ON_RTC.OFFER, room, {"offer":offer,"user":user})
  }

  const sendAnswer = async (socket,localPc,{offer,user}) => {
    console.log("sendAnswer",offer,user)
    // let localPc = new RTCPeerConnection(rtcConfig)
    // openDataChannel(localPc, username)
    // 添加RTC流
    // localStream.getTracks().forEach((track) => {
    //   localPc.addTrack(track, localStream)
    // })
    // 给当前RTC流设置监听事件(协议完成回调)
    // localPc.onicecandidate = (event) => {
    //   console.log('sendAnswer.localPc:', event.candidate, event)
    //   // 回调时，将自己candidate发给对方，对方可以直接addIceCandidate(candidate)添加可以获取流
    //   if (event.candidate)
    //     socket.emit(SOCKET_ON_RTC.CANDIDATE, room, {
    //       pc: 'remote',
    //       candidate: event.candidate,
    //     })
    // }
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

  