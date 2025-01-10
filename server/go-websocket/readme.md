# webSocket

go mod tidy
go run main.go

## test

https://wstool.js.org/

ws://127.0.0.1:3337/ws-rtc?room=1&uid=123

## ngrok

```shell
./ngrok http 3338
# https://wstool.js.org/ 进行测试
wss://c5a1-103-117-76-48.ngrok-free.app/ws-rtc?room=1&uid=123
```

## build

mac

```shell
go mod tidy
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -ldflags '-w -s' -o ./build/mac-ws-rtc ./main.go
```

linux

```shell
go mod tidy
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags '-w -s' -o ./build/linux-ws-rtc ./main.go

```

## docker

```shell
  docker-compose up -d
    docker-compose down
```