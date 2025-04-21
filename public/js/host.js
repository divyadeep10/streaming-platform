document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const localVideo = document.getElementById('localVideo');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const roomIdElement = document.getElementById('roomId');
  const copyBtn = document.getElementById('copyBtn');
  const viewerCountElement = document.getElementById('viewerCount');
  const shareLinkContainer = document.getElementById('shareLinkContainer');
  const shareLinkInput = document.getElementById('shareLink');
  const copyLinkBtn = document.getElementById('copyLinkBtn');

  let localStream;
  let peerConnections = {};
  let roomId;
  let viewerCount = 0;

  // Generate a random room ID
  // Update the room ID generation
  const serverProvidedRoomId = "<%= roomId %>";
  roomId = serverProvidedRoomId || webinarId || Math.random().toString(36).substring(2, 7);
  roomIdElement.textContent = roomId;
  
  // Update the share link generation
  const shareUrl = `${window.location.origin}/view?room=${roomId}`;
  shareLinkInput.value = shareUrl;
  // Copy room ID to clipboard
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(roomId)
      .then(() => {
        alert('Stream ID copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  });

  // Start streaming
  startBtn.addEventListener('click', async () => {
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      
      // Create room
      socket.emit('create-room', roomId);
      
      // Show shareable link
      const url = `${window.location.origin}/view?room=${roomId}`;
      shareLinkInput.value = url;
      shareLinkContainer.style.display = 'block';

      startBtn.disabled = true;
      stopBtn.disabled = false;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera and microphone. Please check permissions.');
    }
  });

  // Stop streaming
  stopBtn.addEventListener('click', () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localVideo.srcObject = null;
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    peerConnections = {};
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    viewerCount = 0;
    viewerCountElement.textContent = viewerCount;
  });

  // Handle new viewer
  socket.on('viewer-joined', async (viewerId) => {
    viewerCount++;
    viewerCountElement.textContent = viewerCount;
    
    // Create a new RTCPeerConnection for this viewer
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    
    peerConnections[viewerId] = peerConnection;
    
    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', event.candidate, viewerId);
      }
    };
    
    // Create and send offer
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('offer', offer, roomId, viewerId);
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  });

  // Handle answer from viewer
  socket.on('answer', async (answer, viewerId) => {
    try {
      const peerConnection = peerConnections[viewerId];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  });

  // Handle ICE candidate from viewer
  socket.on('ice-candidate', (candidate, viewerId) => {
    try {
      const peerConnection = peerConnections[viewerId];
      if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  });

  // Handle viewer disconnect
  socket.on('user-disconnected', (viewerId) => {
    if (peerConnections[viewerId]) {
      peerConnections[viewerId].close();
      delete peerConnections[viewerId];
      
      viewerCount--;
      viewerCountElement.textContent = viewerCount;
    }
  });
});

// Copy link to clipboard
copyLinkBtn.addEventListener('click', () => {
  shareLinkInput.select();
  navigator.clipboard.writeText(shareLinkInput.value)
    .then(() => {
      alert('Shareable link copied!');
    })
    .catch(err => {
      // Fallback for older browsers
      document.execCommand('copy');
      alert('Shareable link copied!');
    });
});

// Add a share button if Web Share API is available
if (navigator.share) {
  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Share Link';
  shareBtn.className = 'btn';
  shareBtn.style.marginLeft = '5px';
  
  shareBtn.addEventListener('click', () => {
    navigator.share({
      title: 'Join my live stream',
      text: 'Click this link to join my live stream',
      url: shareLinkInput.value
    })
    .catch(err => console.error('Error sharing:', err));
  });
  
  shareLinkContainer.appendChild(shareBtn);
}