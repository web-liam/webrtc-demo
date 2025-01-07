const startButton = document.getElementById("startButton");
const callButton = document.getElementById("callButton");
const hangupButton = document.getElementById("hangupButton");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

startButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  callButton.disabled = false;
};

callButton.onclick = async () => {
  peerConnection = new RTCPeerConnection(servers);

  // Handle ICE candidates
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("New ICE candidate:", event.candidate);
      // You would typically send this to the remote peer via signaling
    }
  };

  // Handle remote stream
  peerConnection.ontrack = (event) => {
    if (!remoteStream) {
      remoteStream = new MediaStream();
      remoteVideo.srcObject = remoteStream;
    }
    remoteStream.addTrack(event.track);
  };

  // Add local tracks to the peer connection
  localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

  // Create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log("Offer created and set as local description:", offer);

  // Simulate signaling by directly setting the remote description
  setTimeout(async () => {
    const remoteOffer = peerConnection.localDescription;
    await peerConnection.setRemoteDescription(remoteOffer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    console.log("Answer created and set as local description:", answer);

    peerConnection.setRemoteDescription(answer);
  }, 1000);

  callButton.disabled = true;
  hangupButton.disabled = false;
};

hangupButton.onclick = () => {
  peerConnection.close();
  peerConnection = null;
  callButton.disabled = false;
  hangupButton.disabled = true;
};


console.log('app.js loaded 25-0107-1703');