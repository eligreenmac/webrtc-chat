// ===== VOICE CALL AND LOGOUT FUNCTIONS =====
// Insert this code before the "Event Listeners" section in index.html

// Logout Function
function logout() {
    // Close all peer connections
    peers.forEach((peerData, peerId) => {
        closePeerConnection(peerId);
    });

    // Stop local stream if active
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Disconnect from server
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Reset state
    myUsername = '';
    myId = '';
    peers.clear();
    callState = 'idle';
    isMuted = false;

    // Hide logout button and call controls
    logoutBtn.classList.remove('visible');
    callControls.classList.remove('visible');

    // Return to join screen
    chatScreen.classList.remove('active');
    joinScreen.style.display = 'flex';

    // Clear messages
    messagesContainer.innerHTML = '';

    // Update status
    updateStatus(false);
    statusText.textContent = 'התנתקת מהצ'אט';

    // Clear username input for new login
    usernameInput.value = '';
    usernameInput.focus();
}

// Voice Call Functions
async function initLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        console.log('Local audio stream initialized');
        return true;
    } catch (error) {
        console.error('Error accessing microphone:', error);
        addMessage('', 'שגיאה: לא ניתן לגשת למיקרופון. נא לאשר גישה.', true);
        return false;
    }
}

async function startCall() {
    if (peers.size === 0) {
        addMessage('', 'אין משתמשים מחוברים להתקשר אליהם', true);
        return;
    }

    if (callState !== 'idle') {
        return;
    }

    // Initialize local stream
    if (!localStream) {
        const success = await initLocalStream();
        if (!success) return;
    }

    callState = 'calling';
    callBtn.style.display = 'none';
    hangupBtn.style.display = 'flex';
    callControls.classList.add('visible');
    updateCallStatus('מתקשר...');

    // Add audio tracks to all peer connections
    peers.forEach((peerData, peerId) => {
        localStream.getAudioTracks().forEach(track => {
            peerData.connection.addTrack(track, localStream);
        });

        // Send call-offer via data channel
        if (peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
            peerData.dataChannel.send(JSON.stringify({
                type: 'call-offer',
                from: myUsername,
                fromId: myId
            }));
        }
    });

    // Start call timer
    callStartTime = Date.now();
    startCallTimer();
}

function endCall() {
    // Stop local stream
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // Remove audio tracks and stop remote audio
    peers.forEach((peerData) => {
        // Remove local audio tracks
        const senders = peerData.connection.getSenders();
        senders.forEach(sender => {
            if (sender.track && sender.track.kind === 'audio') {
                peerData.connection.removeTrack(sender);
            }
        });

        // Stop remote audio
        if (peerData.audioElement) {
            peerData.audioElement.pause();
            peerData.audioElement.srcObject = null;
            peerData.audioElement = null;
        }

        // Send call-end via data channel
        if (peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
            peerData.dataChannel.send(JSON.stringify({
                type: 'call-end',
                from: myUsername
            }));
        }
    });

    // Reset call state
    callState = 'idle';
    isMuted = false;
    callBtn.style.display = 'flex';
    hangupBtn.style.display = 'none';
    micBtn.classList.remove('muted');

    // Stop timer
    stopCallTimer();

    updateCallStatus('השיחה הסתיימה');
    addMessage('', 'השיחה הסתיימה', true);

    setTimeout(() => {
        updateCallStatus('מוכן לשיחה');
    }, 2000);
}

function toggleMute() {
    if (!localStream) return;

    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
    });

    if (isMuted) {
        micBtn.classList.add('muted');
        micBtn.innerHTML = '🔇';
    } else {
        micBtn.classList.remove('muted');
        micBtn.innerHTML = '🎤';
    }
}

function showIncomingCall(fromPeer) {
    incomingCallFrom = fromPeer;
    callUsername.textContent = fromPeer.username;
    callAvatar.textContent = fromPeer.username.charAt(0).toUpperCase();
    incomingCall.classList.add('visible');
    modalOverlay.classList.add('visible');
    callState = 'ringing';
}

function hideIncomingCall() {
    incomingCall.classList.remove('visible');
    modalOverlay.classList.remove('visible');
    incomingCallFrom = null;
    if (callState === 'ringing') {
        callState = 'idle';
    }
}

async function acceptCall() {
    hideIncomingCall();

    // Initialize local stream
    if (!localStream) {
        const success = await initLocalStream();
        if (!success) {
            rejectCall();
            return;
        }
    }

    callState = 'in-call';
    callBtn.style.display = 'none';
    hangupBtn.style.display = 'flex';
    callControls.classList.add('visible');

    // Add audio tracks to the caller's peer connection
    if (incomingCallFrom) {
        const peerData = peers.get(incomingCallFrom.id);
        if (peerData) {
            localStream.getAudioTracks().forEach(track => {
                peerData.connection.addTrack(track, localStream);
            });

            // Send call-answer
            if (peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
                peerData.dataChannel.send(JSON.stringify({
                    type: 'call-answer',
                    from: myUsername
                }));
            }
        }
    }

    // Start call timer
    callStartTime = Date.now();
    startCallTimer();

    addMessage('', `שיחה עם ${incomingCallFrom?.username || 'משתמש'}`, true);
}

function rejectCall() {
    if (incomingCallFrom) {
        const peerData = peers.get(incomingCallFrom.id);
        if (peerData && peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
            peerData.dataChannel.send(JSON.stringify({
                type: 'call-reject',
                from: myUsername
            }));
        }
    }
    hideIncomingCall();
    addMessage('', 'דחית את השיחה', true);
}

function updateCallStatus(text) {
    callStatus.textContent = text;
    if (callState === 'in-call') {
        callStatus.classList.add('active');
    } else {
        callStatus.classList.remove('active');
    }
}

function startCallTimer() {
    stopCallTimer();
    callTimer = setInterval(() => {
        if (!callStartTime) return;
        const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        updateCallStatus(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
}

function stopCallTimer() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    callStartTime = null;
}

// Handle remote audio tracks
function handleRemoteTrack(peerId, event) {
    const peerData = peers.get(peerId);
    if (!peerData) return;

    console.log('Received remote track:', event.track.kind);

    if (event.track.kind === 'audio') {
        // Create audio element for remote audio
        if (!peerData.audioElement) {
            peerData.audioElement = new Audio();
            peerData.audioElement.autoplay = true;
        }
        peerData.audioElement.srcObject = event.streams[0];

        // Try to play (handle autoplay policy)
        peerData.audioElement.play().catch(err => {
            console.log('Autoplay prevented, user interaction needed');
        });
    }
}

// ===== ADD EVENT LISTENERS =====
logoutBtn.addEventListener('click', logout);
callBtn.addEventListener('click', startCall);
hangupBtn.addEventListener('click', endCall);
micBtn.addEventListener('click', toggleMute);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);
