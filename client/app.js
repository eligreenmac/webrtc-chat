// Configuration
const SERVER_URL = window.location.origin;

// WebRTC configuration
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// State
let socket = null;
let myUsername = '';
let myId = '';
let peers = new Map(); //peerId -> { username, connection, dataChannel, audioElement }

// Voice call state
let localStream = null;
let callState = 'idle'; // 'idle', 'calling', 'ringing', 'in-call'
let isMuted = false;
let callStartTime = null;
let callTimer = null;
let incomingCallFrom = null;

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const chatScreen = document.getElementById('chatScreen');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const logoutBtn = document.getElementById('logoutBtn');
const callControls = document.getElementById('callControls');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const micBtn = document.getElementById('micBtn');
const callStatus = document.getElementById('callStatus');
const incomingCall = document.getElementById('incomingCall');
const modalOverlay = document.getElementById('modalOverlay');
const acceptCallBtn = document.getElementById('acceptCallBtn');
const rejectCallBtn = document.getElementById('rejectCallBtn');
const callUsername = document.getElementById('callUsername');
const callAvatar = document.getElementById('callAvatar');

// Utility Functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function addMessage(username, message, isSystem = false) {
    const messageEl = document.createElement('div');

    if (isSystem) {
        messageEl.className = 'system-message';
        messageEl.textContent = message;
    } else {
        messageEl.className = 'message';
        const initial = username.charAt(0).toUpperCase();
        const time = new Date().toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageEl.innerHTML = `
            <div class="message-avatar">${initial}</div>
            <div class="message-content">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(message)}</div>
            </div>
        `;
    }

    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateStatus(connected) {
    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'מחובר';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'מנותק';
    }
}

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
    statusText.textContent = 'התנתקת מהצ\'אט';

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

// Join Chat
function joinChat() {
    const username = usernameInput.value.trim();
    if (!username) {
        usernameInput.focus();
        return;
    }

    myUsername = username;

    // Connect to signaling server
    socket = io(SERVER_URL);

    socket.on('connect', () => {
        console.log('Connected to signaling server');
        myId = socket.id;
        updateStatus(true);

        // Register username
        socket.emit('register', { username: myUsername });

        // Switch to chat screen
        joinScreen.style.display = 'none';
        chatScreen.classList.add('active');
        logoutBtn.classList.add('visible');
        callControls.classList.add('visible');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from signaling server');
        updateStatus(false);
        addMessage('', 'נותקת משרת הסיגנלינג', true);
    });

    socket.on('peers-list', (peerList) => {
        console.log('Received peers list:', peerList);
        // Connect to each existing peer
        peerList.forEach(peer => {
            createPeerConnection(peer.id, peer.username, true);
        });
    });

    socket.on('peer-joined', (peer) => {
        console.log('Peer joined:', peer);
        addMessage('', `${peer.username} הצטרף לצ'אט`, true);
    });

    socket.on('peer-left', (peer) => {
        console.log('Peer left:', peer);
        addMessage('', `${peer.username} עזב את הצ'אט`, true);
        closePeerConnection(peer.id);
    });

    socket.on('offer', async ({ fromId, fromPeer, offer }) => {
        console.log('Received offer from:', fromPeer);
        await handleOffer(fromId, fromPeer, offer);
    });

    socket.on('answer', async ({ fromId, fromPeer, answer }) => {
        console.log('Received answer from:', fromPeer);
        await handleAnswer(fromId, answer);
    });

    socket.on('ice-candidate', async ({ fromId, candidate }) => {
        await handleIceCandidate(fromId, candidate);
    });
}

// WebRTC Functions
async function createPeerConnection(peerId, peerUsername, initiator = false) {
    if (peers.has(peerId)) {
        console.log('Already connected to:', peerUsername);
        return;
    }

    console.log('Creating peer connection with:', peerUsername, 'Initiator:', initiator);

    const pc = new RTCPeerConnection(rtcConfig);
    const peerData = { username: peerUsername, connection: pc, dataChannel: null, audioElement: null };
    peers.set(peerId, peerData);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                targetId: peerId,
                candidate: event.candidate
            });
        }
    };

    pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            closePeerConnection(peerId);
        }
    };

    // Handle incoming audio tracks
    pc.ontrack = (event) => {
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
    };

    if (initiator) {
        // Create data channel
        const dataChannel = pc.createDataChannel('chat');
        setupDataChannel(peerId, dataChannel);
        peerData.dataChannel = dataChannel;

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('offer', {
            targetId: peerId,
            offer: offer
        });
    } else {
        // Wait for data channel
        pc.ondatachannel = (event) => {
            setupDataChannel(peerId, event.channel);
            peerData.dataChannel = event.channel;
        };
    }
}

async function handleOffer(peerId, peerInfo, offer) {
    await createPeerConnection(peerId, peerInfo.username, false);

    const peerData = peers.get(peerId);
    const pc = peerData.connection;

    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit('answer', {
        targetId: peerId,
        answer: answer
    });
}

async function handleAnswer(peerId, answer) {
    const peerData = peers.get(peerId);
    if (peerData) {
        await peerData.connection.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

async function handleIceCandidate(peerId, candidate) {
    const peerData = peers.get(peerId);
    if (peerData) {
        try {
            await peerData.connection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }
}

function setupDataChannel(peerId, dataChannel) {
    const peerData = peers.get(peerId);

    dataChannel.onopen = () => {
        console.log('Data channel opened with:', peerData.username);
        addMessage('', `התחבר ל-${peerData.username}`, true);
        sendBtn.disabled = false;
    };

    dataChannel.onclose = () => {
        console.log('Data channel closed with:', peerData.username);
    };

    dataChannel.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Handle different message types
        if (data.type === 'call-offer') {
            showIncomingCall({ id: peerId, username: data.from });
        } else if (data.type === 'call-answer') {
            callState = 'in-call';
            updateCallStatus('בשיחה');
            addMessage('', `${data.from} קיבל את השיחה`, true);
        } else if (data.type === 'call-reject') {
            addMessage('', `${data.from} דחה את השיחה`, true);
            endCall();
        } else if (data.type === 'call-end') {
            addMessage('', `${data.from} סיים את השיחה`, true);
            endCall();
        } else {
            // Regular chat message
            addMessage(data.username, data.message);
        }
    };

    dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
    };
}

function closePeerConnection(peerId) {
    const peerData = peers.get(peerId);
    if (peerData) {
        if (peerData.dataChannel) {
            peerData.dataChannel.close();
        }
        if (peerData.audioElement) {
            peerData.audioElement.pause();
            peerData.audioElement.srcObject = null;
        }
        peerData.connection.close();
        peers.delete(peerId);

        // Disable send button if no peers
        if (peers.size === 0) {
            sendBtn.disabled = true;
        }
    }
}

// Send Message
function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    // Add to local UI
    addMessage(myUsername, message);

    // Send to all peers via WebRTC
    const data = JSON.stringify({
        username: myUsername,
        message: message
    });

    peers.forEach((peerData, peerId) => {
        if (peerData.dataChannel && peerData.dataChannel.readyState === 'open') {
            peerData.dataChannel.send(data);
        }
    });

    messageInput.value = '';
    messageInput.focus();
}

// Event Listeners
logoutBtn.addEventListener('click', logout);
callBtn.addEventListener('click', startCall);
hangupBtn.addEventListener('click', endCall);
micBtn.addEventListener('click', toggleMute);
acceptCallBtn.addEventListener('click', acceptCall);
rejectCallBtn.addEventListener('click', rejectCall);

joinBtn.addEventListener('click', joinChat);
usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinChat();
});

sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Focus input
usernameInput.focus();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful:', registration.scope);
            })
            .catch((err) => {
                console.log('ServiceWorker registration failed:', err);
            });
    });
}
