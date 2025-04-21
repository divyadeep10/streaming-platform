document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const localVideo = document.getElementById('localVideo');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const viewerCountElement = document.getElementById('viewerCount');
  const streamStatusElement = document.getElementById('streamStatus');
  const studentLinkInput = document.getElementById('studentLink');
  const copyStudentLinkBtn = document.getElementById('copyStudentLinkBtn');
  const returnBtn = document.getElementById('returnBtn');

  let localStream;
  let peerConnections = {};
  let roomId;
  let viewerCount = 0;

  // Get room ID from URL or generate a new one
  const urlParams = new URLSearchParams(window.location.search);
  const providedRoomId = urlParams.get('room');
  const webinarId = urlParams.get('webinar');

  // Use the provided room ID or webinar ID directly without modification
  roomId = providedRoomId || webinarId || Math.random().toString(36).substring(2, 7);

  // Generate student link with the exact room ID
  const studentLink = `${window.location.origin}/student/view?room=${roomId}&transport=websocket`;
  studentLinkInput.value = studentLink;

  // Update the copy functionality to ensure exact ID is copied
  copyStudentLinkBtn.addEventListener('click', () => {
    studentLinkInput.select();
    navigator.clipboard.writeText(studentLinkInput.value)
      .then(() => {
        // Add visual feedback
        const originalText = copyStudentLinkBtn.textContent;
        copyStudentLinkBtn.textContent = 'Copied!';
        copyStudentLinkBtn.style.backgroundColor = '#2ecc71';
        
        setTimeout(() => {
          copyStudentLinkBtn.textContent = originalText;
          copyStudentLinkBtn.style.backgroundColor = '';
        }, 2000);
      })
      .catch(err => {
        // Fallback for older browsers
        document.execCommand('copy');
        alert('Student link copied!');
      });
  });

  // Start streaming
  startBtn.addEventListener('click', async () => {
    try {
      streamStatusElement.textContent = 'Starting...';
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      
      // Create room
      socket.emit('create-room', roomId);
      
      startBtn.disabled = true;
      stopBtn.disabled = false;
      streamStatusElement.textContent = 'Live';
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Could not access camera and microphone. Please check permissions.');
      streamStatusElement.textContent = 'Error';
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
    streamStatusElement.textContent = 'Ready';
  });

  // Return to dashboard
  returnBtn.addEventListener('click', () => {
    // First check if stream is active
    if (localStream && localStream.active) {
      if (confirm('Ending the stream will disconnect all viewers. Are you sure?')) {
        stopBtn.click();
        window.location.href = '/dashboard';
      }
    } else {
      window.location.href = '/dashboard';
    }
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

// Add this code to your existing alumni-host.js file

// Function to update the student join link
function updateStudentLink(roomId) {
  const studentLinkInput = document.getElementById('studentLink');
  const linkStatus = document.getElementById('linkStatus');
  const studentLink = `http://localhost:3000/student/view?room=${roomId}`;
  
  studentLinkInput.value = studentLink;
  linkStatus.textContent = 'Link is ready to share';
  linkStatus.style.color = 'green';
}

// Get room ID from URL
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

// Update student link when page loads
if (roomId) {
  updateStudentLink(roomId);
}

// Copy link button functionality
document.getElementById('copyStudentLinkBtn').addEventListener('click', () => {
  const studentLinkInput = document.getElementById('studentLink');
  studentLinkInput.select();
  document.execCommand('copy');
  
  // Show feedback
  const linkStatus = document.getElementById('linkStatus');
  linkStatus.textContent = 'Link copied to clipboard!';
  linkStatus.style.color = 'green';
  
  // Reset status after 3 seconds
  setTimeout(() => {
    linkStatus.textContent = 'Link is ready to share';
  }, 3000);
});

// Add this to your existing socket connection code
socket.on('room-created', (createdRoomId) => {
  // Update the student link with the created room ID
  updateStudentLink(createdRoomId);
});

// Add a link status element to the DOM if it doesn't exist
if (!document.getElementById('linkStatus')) {
  const linkContainer = document.getElementById('studentLinkContainer');
  const statusElement = document.createElement('p');
  statusElement.id = 'linkStatus';
  statusElement.className = 'link-status';
  statusElement.style.marginTop = '8px';
  statusElement.style.fontSize = '14px';
  statusElement.style.color = 'green';
  statusElement.textContent = 'Link is ready to share';
  linkContainer.appendChild(statusElement);
}