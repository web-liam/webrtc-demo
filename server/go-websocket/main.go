package main

import (
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const port = "3337"

var (
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// 允许所有来源连接，生产环境需要更严格的检查
			return true
		},
	}

	rooms        = make(map[string]map[*ConnItem]bool) // 房间 -> (ConnItem -> bool)
	userLists    = make(map[string][]string)           // 房间 -> 在线用户列表
	broadcast    = make(chan Message)
	mutex        = sync.Mutex{}
	userListType = "userlist"
)

// Message 定义信令消息结构
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
	Room string      `json:"room"`
	Uid  string      `json:"sid"`
}

type ConnItem struct {
	Conn *websocket.Conn
	Uid  string
}

func main() {
	http.HandleFunc("/ws-rtc", handleConnections)

	// 启动消息处理
	go handleMessages()

	fmt.Printf("[INFO] WebRTC WebSocket 服务已启动，监听端口 %s\n", port)
	if err := http.ListenAndServe(":"+port, nil); err != nil {
		fmt.Printf("[ERROR] 服务器启动失败: %s\n", err)
	}
}

// handleConnections 处理 WebSocket 连接
func handleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("[ERROR] 连接升级失败: %s \n", err)
		return
	}
	defer conn.Close()

	// 从 URL 参数获取房间号和用户名
	room := r.URL.Query().Get("room")
	uid := r.URL.Query().Get("uid")
	if room == "" {
		room = "0"
	}
	if uid == "" {
		uid = fmt.Sprintf("%d", time.Now().Unix()) // 生成时间戳作为 uid
		fmt.Println("[INFO] 随机生成 uid", uid)
	}
	connItem := &ConnItem{Conn: conn, Uid: uid}
	addConnectionToRoom(room, connItem)
	BroadcastUserList(room, userListType)
	fmt.Printf("[INFO] 新客户端 [%s] 加入房间 %s: %s \n", uid, room, conn.RemoteAddr())
	// 读取客户端消息并广播
	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			fmt.Printf("[ERROR] 房间 %s 的,【%s】客户端断开: %s \n", room, connItem.Uid, conn.RemoteAddr())
			handleDisconnection(connItem, room)
			BroadcastUserList(room, userListType)
			break
		}
		msg.Room = room
		msg.Uid = connItem.Uid
		broadcast <- msg
	}
}

// addConnectionToRoom 将客户端加入指定房间
func addConnectionToRoom(room string, connItem *ConnItem) {
	mutex.Lock()
	defer mutex.Unlock()
	if _, exists := rooms[room]; !exists {
		rooms[room] = make(map[*ConnItem]bool)
		userLists[room] = []string{}
	}
	rooms[room][connItem] = true
	userLists[room] = append(userLists[room], connItem.Uid)
}

// handleMessages 处理信令消息的广播
func handleMessages() {
	for msg := range broadcast {
		room := msg.Room
		mutex.Lock()
		if connItems, exists := rooms[room]; exists {
			for connItem := range connItems {
				if err := connItem.Conn.WriteJSON(msg); err != nil {
					fmt.Printf("[ERROR] 消息发送失败: %s\n", err)
					handleDisconnection(connItem, room)
				}
			}
			fmt.Printf("[INFO] 消息发送: %+v\n", msg)
		}
		mutex.Unlock()
	}
}

// handleDisconnection 处理客户端断开连接
func handleDisconnection(connItem *ConnItem, room string) {
	mutex.Lock()
	defer mutex.Unlock()

	if connItems, exists := rooms[room]; exists {
		delete(connItems, connItem)
		if len(connItems) == 0 {
			delete(rooms, room)
		}
	}
	userLists[room] = remove(userLists[room], connItem.Uid)
	connItem.Conn.Close()
}

// remove 从切片中移除指定元素
func remove(slice []string, item string) []string {
	for i, v := range slice {
		if v == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

// 广播房间用户列表
func BroadcastUserList(room string, ty string) {
	mutex.Lock()
	defer mutex.Unlock()
	if userList, exists := userLists[room]; exists {
		msg := Message{
			Type: ty, //"userlist",
			Data: userList,
			Room: room,
			Uid:  "0",
		}
		if connItems, ok := rooms[room]; ok {
			for connItem := range connItems {
				if err := connItem.Conn.WriteJSON(msg); err != nil {
					fmt.Printf("[ERROR] 用户列表广播失败: %s \n", err)
					handleDisconnection(connItem, room)
				}
			}
			fmt.Printf("[INFO] 用户列表已广播至房间 %s: %v \n", room, userList)
		}
	}
}
