let APP_ID = "";

let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const roomId = urlParams.get("room");

if (!roomId) {
  window.location = "lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const handleMessageFromPeer = async (message, MemberId) => {
  message = JSON.parse(message.text);
  if (message.type === "offer") {
    createAnswer(MemberId, message.offer);
  }

  if (message.type === "answer") {
    addAnswer(message.answer);
  }

  if (message.type === "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};

const constraints = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: true,
};

const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", handleUserJoined);

  channel.on("MemberLeft", handleUserLeft);

  client.on("MessageFromPeer", handleMessageFromPeer);

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById("user-1").srcObject = localStream;
};

const handleUserLeft = async (MemberId) => {
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("smallFrame");
};

const handleUserJoined = async (MemberId) => {
  console.log("New User Joined the Channel:", MemberId);
  createOffer(MemberId);
};

const createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";
  document.getElementById("user-1").classList.add("smallFrame");

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
  }
  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      const iceData = JSON.stringify({
        type: "candidate",
        candidate: event.candidate,
      });
      client.sendMessageToPeer(
        {
          text: iceData,
        },
        MemberId
      );
    }
  };
};

const createOffer = async (MemberId) => {
  await createPeerConnection(MemberId);
  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  const offerData = JSON.stringify({ type: "offer", offer: offer });
  client.sendMessageToPeer(
    // eslint-disable-next-line
    { text: offerData },
    MemberId
  );

  console.log("offer:", offer);
};

const createAnswer = async (MemberId, offer) => {
  await createPeerConnection(MemberId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  const data = JSON.stringify({ type: "answer", answer: answer });
  client.sendMessageToPeer(
    // eslint-disable-next-line
    { text: data },
    MemberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async () => {
  await channel.leave();
  await channel.logout();
};

const toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");
  videoTrack.enabled = !videoTrack.enabled;
  document.getElementById("camera-btn").style.backgroundColor =
    videoTrack.enabled ? "rgb(179, 102, 249, 0.9)" : "rgb(255, 80, 80)";
};

const toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");
  audioTrack.enabled = !audioTrack.enabled;
  document.getElementById("mic-btn").style.backgroundColor = audioTrack.enabled
    ? "rgb(179, 102, 249, 0.9)"
    : "rgb(255, 80, 80)";
};

window.addEventListener("beforeunload", leaveChannel);

document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);

init();
