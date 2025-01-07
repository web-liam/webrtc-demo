import { SOCKET_EMIT, SOCKET_ON_SYS } from './enum.js'
import SocketRtc from './on.js'
import initApp from './config.js'
// 初始化应用
let io = initApp(3338)
let members = []
// let links = [] // 链接列表

// 监听连接
io.on(SOCKET_ON_SYS.CONNECTION, (socket) => {
  const { query } = socket.handshake
  // 获取socket连接参数 username和room
  const username = query.username
  const room = query.room
  console.log(`[INFO]CONNECTION room:${room}----${username}----(请求连接)`)
  // if (members.length === 2) {
  //   console.log('仅支持两人加入房间')
  //   return
  // }
  // 连接管理
  let user = { sid: socket.id, username , room }
  members.push(user)
  // 房间管理
  socket.join(room)
  // 每次连接向房间发送用户列表
  io.to(room).emit(SOCKET_EMIT.SYS_USER_LIST, members)
  // 管理rtc的监听事件
  SocketRtc(socket,username)
  
  socket.on(SOCKET_EMIT.LINK_USER, (room, data) => {
    console.log(`[INFO]SOCKET_EMIT.LINK_USER: room ${room} data:`,data)
    socket.to(room).emit(SOCKET_EMIT.LINK_USER, room, data)
    // links.push(data)
  })

  socket.on(SOCKET_EMIT.MESSAGE, (room, data) => {
    console.log(`[INFO]收到消息: ${data}, 来自于房间: ${room}`)
    socket.to(room).emit(SOCKET_EMIT.MESSAGE, room, data)
  })

  // 断开连接了
  socket.on(SOCKET_ON_SYS.DISCONNECT, () => {
    console.log(`[INFO]SOCKET_ON_SYS.DISCONNECT: ${username}----(断开连接)`)
    members = members.filter(m => m.username !== user.username)
    // 每次连接发送用户列表
    io.to(room).emit(SOCKET_EMIT.SYS_USER_LIST, members)
  })
})
