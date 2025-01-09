package main

import (
	"fmt"
	"net/http"
	"sync"

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
	// clients   = make(map[*websocket.Conn]bool)
	rooms     = make(map[string]map[*websocket.Conn]bool) // 客户端连接与房间映射
	broadcast = make(chan Message)
	mutex     = sync.Mutex{}
)

// Message 定义信令消息结构
type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
	Room string      `json:"room"`
}

func main() {
	http.HandleFunc("/ws-rtc", handleConnections)

	// 启动消息处理
	go handleMessages()

	fmt.Println("[INFO]WebRTC WebSocket 服务已启动，监听端口 " + port)
	err := http.ListenAndServe(":"+port, nil)
	if err != nil {
		fmt.Println("[ERROR]服务器启动失败:", err)
	}
}

// handleConnections 处理 WebSocket 连接
func handleConnections(w http.ResponseWriter, r *http.Request) {
	// 升级 HTTP 连接到 WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("[ERROR]连接升级失败:", err)
		return
	}
	defer conn.Close()

	// 从 URL 参数获取房间号
	room := r.URL.Query().Get("room")
	if room == "" {
		fmt.Println("[ERROR]房间号缺失，关闭连接")
		return
	}

	// 将新客户端加入到连接列表
	mutex.Lock()
	if _, ok := rooms[room]; !ok {
		rooms[room] = make(map[*websocket.Conn]bool)
	}
	rooms[room][conn] = true
	// clients[conn] = true
	mutex.Unlock()

	fmt.Printf("新客户端加入房间 %s: %s\n", room, conn.RemoteAddr())

	// 读取客户端消息并广播
	for {
		var msg Message
		err := conn.ReadJSON(&msg)
		if err != nil {
			fmt.Printf("[ERROR]房间 %s 的客户端断开: %s\n", room, conn.RemoteAddr())
			mutex.Lock()
			delete(rooms[room], conn)
			// delete(clients, conn)
			mutex.Unlock()
			break
		}
		// 确保消息的房间号一致
		msg.Room = room
		broadcast <- msg
	}
}

// handleMessages 处理信令消息的广播
func handleMessages() {
	for {
		msg := <-broadcast
		room := msg.Room
		mutex.Lock()
		for client := range rooms[room] {
			err := client.WriteJSON(msg)
			if err != nil {
				fmt.Println("[ERROR]消息发送失败:", err)
				client.Close()
				delete(rooms[room], client)
				// delete(clients, client)
			}
			fmt.Println("[INFO]消息发送:", msg)
		}
		mutex.Unlock()
	}
}
