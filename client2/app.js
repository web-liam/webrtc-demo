
const startButton = document.getElementById('start');
const connectButton = document.getElementById('connect');
const sendMessageButton = document.getElementById('sendMessage');
const messageBox = document.getElementById('messageBox');
const inputMessage = document.getElementById('inputMessage');

let localConnection;
let remoteConnection;
let dataChannel;

// 添加日志
function logMessage(message) {
  messageBox.value += `${message}\n`;
}

// 开始连接
startButton.addEventListener('click', () => {
  localConnection = new RTCPeerConnection();
  logMessage('Local RTCPeerConnection created.');

  dataChannel = localConnection.createDataChannel('chat');
  logMessage('DataChannel created.');

  dataChannel.onopen = () => logMessage('DataChannel opened.');
  dataChannel.onmessage = (event) => logMessage(`Received: ${event.data}`);

  localConnection.onicecandidate = (event) => {
    if (event.candidate) {
      logMessage('Sending ICE candidate to remote peer.');
      remoteConnection.addIceCandidate(event.candidate);
    }
  };

  remoteConnection = new RTCPeerConnection();
  remoteConnection.ondatachannel = (event) => {
    remoteConnection.dataChannel = event.channel;
    remoteConnection.dataChannel.onmessage = (e) => logMessage(`Remote received: ${e.data}`);
    remoteConnection.dataChannel.onopen = () => logMessage('Remote DataChannel opened.');
  };

  remoteConnection.onicecandidate = (event) => {
    if (event.candidate) {
      logMessage('Sending ICE candidate to local peer.');
      localConnection.addIceCandidate(event.candidate);
    }
  };

  logMessage('Connections created. Click "Connect" to establish connection.');
});

// 连接
connectButton.addEventListener('click', async () => {
  const offer = await localConnection.createOffer();
  await localConnection.setLocalDescription(offer);
  logMessage('Local offer created.');

  await remoteConnection.setRemoteDescription(offer);
  const answer = await remoteConnection.createAnswer();
  await remoteConnection.setLocalDescription(answer);
  await localConnection.setRemoteDescription(answer);
  logMessage('Connection established.');
});

// 发送消息
sendMessageButton.addEventListener('click', () => {
  const message = inputMessage.value;
  if (dataChannel && dataChannel.readyState === 'open') {
    dataChannel.send(message);
    logMessage(`Sent: ${message}`);
    inputMessage.value = '';
  } else {
    logMessage('DataChannel is not open.');
  }
});

