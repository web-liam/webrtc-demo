import express from "express";
import http from "http";
import { Server as IO } from "socket.io";
/**
 * 初始化 express
 * @param app
 * @returns
 */
export default function initApp(port) {
  let app = express();

    // 配置跨域中间件
    // app.use(cors({
    //   origin: '*',
    //   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    //   allowedHeaders: ['Content-Type', 'Authorization'],
    //   credentials: true
    // }));

  // 添加根路径处理
  app.get('/', (req, res) => {
    console.log('hello')
    res.send('hello');
  });

  let http_server = http.createServer(app);
  http_server.listen(port);
  let io = new IO(http_server, {
    path: "/rtc", // rtc
    // 允许跨域访问
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  http_server.on("listening", () => {
    let addr = http_server.address();
    if (addr) {
      let port = typeof addr === "string" ? addr : addr.port;
      console.log(`Listening on ${port}`);
    }
  });
  return io;
}
