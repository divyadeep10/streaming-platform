document.addEventListener('DOMContentLoaded', () => {
  // Change this line:
  // const socket = io();
  
  // To this:
  const socket = io({
    transports: ['polling'],
    upgrade: false,
    forceNew: true,
    reconnectionAttempts: 5,
    timeout: 20000
  });
  
  const remoteVideo = document.getElementById('remoteVideo');
  const joinBtn = document.getElementById('joinBtn');
  const roomIdInput = document.getElementById('roomIdInput');
  const statusMessage = document.getElementById('statusMessage');

  let peerConnection;
  let roomId;

  // Helper to get query param
  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Enhance the auto-join functionality
  const autoRoomId = getQueryParam('room');
  if (autoRoomId) {
    roomIdInput.value = autoRoomId;
    // Auto-join after a short delay to ensure everything is initialized
    setTimeout(() => {
      joinStream(autoRoomId);
    }, 1000);
  }

  // Update the join button click handler
  joinBtn.addEventListener('click', () => {
    const inputRoomId = roomIdInput.value.trim();
    if (!inputRoomId) {
      alert('Please enter a Stream ID');
      return;
    }
    window.location.href = `${window.location.origin}/view?room=${inputRoomId}`;
  });

  async function joinStream(roomId) {
    statusMessage.textContent = 'Connecting to stream...';
    
    // Join room
    socket.emit('join-room', roomId);
    
    // Create peer connection
    peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      remoteVideo.srcObject = event.streams[0];
      statusMessage.textContent = 'Connected to stream';
    };
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate, socket.hostId);
      }
    };
    
    // Handle connection state changes
    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'disconnected' || 
          peerConnection.iceConnectionState === 'failed' || 
          peerConnection.iceConnectionState === 'closed') {
        statusMessage.textContent = 'Disconnected from stream';
        remoteVideo.srcObject = null;
      }
    };
  }

  // Handle offer from host
  socket.on('offer', async (offer, hostId) => {
    socket.hostId = hostId;
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('answer', answer, hostId);
    } catch (error) {
      console.error('Error creating answer:', error);
      statusMessage.textContent = 'Error connecting to stream';
    }
  });

  // Handle ICE candidate from host
  socket.on('ice-candidate', (candidate) => {
    try {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  });

  // Handle host disconnect
  socket.on('user-disconnected', (userId) => {
    if (userId === socket.hostId) {
      statusMessage.textContent = 'Host ended the stream';
      remoteVideo.srcObject = null;
    }
  });

  // Auto-join after everything is initialized
  if (autoRoomId) {
    // Small delay to ensure everything is ready
    setTimeout(() => {
      joinBtn.click();
    }, 500);
  }
});