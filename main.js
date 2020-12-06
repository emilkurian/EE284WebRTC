// TODO: Replace with your own channel ID
const drone = new ScaleDrone('ciRHD28afm94BoU4');
// Room name needs to be prefixed with 'observable-'
const roomName = 'observable-' + 101010;
const configuration = {
  iceServers: [{
    urls: 'stun:stun.l.google.com:19302'
  }]
};
let room;
let pc;
let localStream;
let memberLength;

// Define action buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;

// functions
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);

function trace(message) {
  console.log(message)
};
function traceError(error) {
  console.error(error);
};

function startAction() {
  trace('Start Button Inititated');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    localStream = stream;
  }, traceError);
  trace('Local Stream Enabled');
  if (memberLength === 2) {
  callButton.disabled = false;
  }
  trace('Call Button Activated')
}
        
function callAction() {
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace('Starting call.');
  startWebRTC(true);
  trace('Message Sent')
}
  
function hangupAction() {
  pc.close();
  pc = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}
        
drone.on('open', error => {
  if (error) {
    return traceError(error);
  }
  room = drone.subscribe(roomName);
  room.on('open', error => {
    if (error) {
      traceError(error);
    }
  });
  trace(roomName);
  // We're connected to the room and received an array of 'members'
  // connected to the room (including us). Signaling server is ready.
  room.on('members', members => {
    memberLength = members.length
    trace('MEMBERS:' + members.length);
  });
});

// Send signaling data via Scaledrone
function sendMessage(message) {
  drone.publish({
    room: roomName,
    message
  });
}

function startWebRTC(isOfferer) {
  pc = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  trace('Stream added')
  // 'onicecandidate' notifies us whenever an ICE agent needs to deliver a
  // message to the other peer through the signaling server
  pc.onicecandidate = event => {
    if (event.candidate) {
      sendMessage({'candidate': event.candidate});
      trace('Ice candidate' + event.candidate);
    }
  };

  // If user is offerer let the 'negotiationneeded' event create the offer
  if (isOfferer) {
    pc.onnegotiationneeded = () => {
      pc.createOffer().then(localDescCreated).catch(traceError);
      trace('Offer Created');
    }
  }

  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  }).then(stream => {
    // Display your local video in #localVideo element
    localVideo.srcObject = stream;
    // Add your stream to be sent to the conneting peer
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  }, traceError);
  
  // When a remote stream arrives display it in the #remoteVideo element
  pc.ontrack = event => {
    const stream = event.streams[0];
    if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== stream.id) {
      remoteVideo.srcObject = stream;
    }
    trace('remoteStream');
  };

  // Listen to signaling data from Scaledrone
  room.on('data', (message, client) => {
    // Message was sent by us
    if (client.id === drone.clientId) {
      return;
    }

    if (message.sdp) {
      // This is called after receiving an offer or answer from another peer
      pc.setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
        // When receiving an offer lets answer it
        if (pc.remoteDescription.type === 'offer') {
          pc.createAnswer().then(localDescCreated).catch(traceError);
        }
      }, traceError);
    } else if (message.candidate) {
      // Add the new ICE candidate to our connections remote description
      pc.addIceCandidate(
        new RTCIceCandidate(message.candidate), trace, traceError
      );
    }
  });
}

function localDescCreated(desc) {
  pc.setLocalDescription(
    desc,
    () => sendMessage({'sdp': pc.localDescription}),
    traceError
  );
}
