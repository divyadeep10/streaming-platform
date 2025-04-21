document.addEventListener('DOMContentLoaded', () => {
  // Optimize Socket.io connection for Vercel
  const socket = io({
    transports: ['polling', 'websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
    path: '/socket.io/'
  });
  
  const remoteVideo = document.getElementById('remoteVideo');
  const joinBtn = document.getElementById('joinBtn');
  const roomIdInput = document.getElementById('roomIdInput');
  const statusMessage = document.getElementById('statusMessage');
  const autoJoinMessage = document.getElementById('autoJoinMessage');
  const returnBtn = document.getElementById('returnBtn');

  let peerConnection;
  let roomId;

  // Helper to get query param
  function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  }

  // Check for auto-join from URL
  const autoRoomId = getQueryParam('room');
  if (autoRoomId) {
    roomIdInput.value = autoRoomId;
    autoJoinMessage.style.display = 'block';
    
    // Auto-join after a short delay to ensure everything is initialized
    setTimeout(() => {
      joinStream(autoRoomId);
    }, 1000);
  }

  // Join button click handler
  joinBtn.addEventListener('click', () => {
    const inputRoomId = roomIdInput.value.trim();
    if (!inputRoomId) {
      alert('Please enter a Stream ID');
      return;
    }
    joinStream(inputRoomId);
  });

  // Return button click handler
  returnBtn.addEventListener('click', () => {
    window.location.href = '/webinars';
  });

  async function joinStream(roomId) {
    try {
      statusMessage.textContent = 'Connecting to stream...';
      
      // Create peer connection before joining room
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
        autoJoinMessage.style.display = 'none';
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
      
      // Join room after setting up peer connection
      socket.emit('join-room', roomId);
    } catch (error) {
      console.error('Error setting up connection:', error);
      statusMessage.textContent = 'Failed to setup connection';
    }
  }

  // Handle offer from host
  socket.on('offer', async (offer, hostId) => {
    try {
      if (!peerConnection) {
        console.error('PeerConnection not initialized');
        return;
      }
      
      socket.hostId = hostId;
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
});