// static/js/ai-receptionist.js

class AIReceptionist {
    constructor() {
        // ... (all your existing element selections are perfect)
        this.modal = document.getElementById('ai-modal');
        this.overlay = document.getElementById('ai-modal-overlay');
        this.closeBtn = document.getElementById('ai-modal-close');
        this.micButton = document.getElementById('ai-mic-button');
        this.muteButton = document.getElementById('ai-mute-button');
        this.endButton = document.getElementById('ai-end-button');
        this.statusDot = document.querySelector('#ai-status span');
        this.statusText = document.getElementById('ai-status-text');

        this.mediaStream = null;
        this.isMuted = false;
        this.socket = null;
        this.mediaRecorder = null;
        
        // --- NEW: Audio context for seamless playback ---
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioQueue = [];
        this.isPlaying = false;
        this.thinkingAudio = new Audio('/static/thinking.mp3');
        // --- END NEW ---

        this.init();
    }

    init() {
        this.bindBookButtons();
        this.bindModalEvents();
        this.bindKeyboardEvents();
    }

    // ... (your setStatus, bindBookButtons, bindModalEvents, bindKeyboardEvents, toggleMute, closeModal functions are perfect as they are)
    setStatus(state, text) {
        const colors = {
            waiting: 'bg-yellow-400',
            listening: 'bg-green-500',
            muted: 'bg-gray-400',
            error: 'bg-red-500',
            ended: 'bg-gray-400',
            connecting: 'bg-blue-400',
            thinking: 'bg-purple-400', // Added thinking state
            speaking: 'bg-blue-500' // Added speaking state
        };
        this.statusDot.className = `inline-flex h-3 w-3 rounded-full ${colors[state] || 'bg-gray-400'}`;
        this.statusText.textContent = text;
    }

    bindBookButtons() {
        const bookButtons = document.querySelectorAll('#book-appointment, .btn-appointment');
        bookButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openModalAndRequestMic();
            });
        });
    }

    bindModalEvents() {
        this.overlay.addEventListener('click', () => this.closeModal());
        this.closeBtn.addEventListener('click', () => this.closeModal());
        this.endButton.addEventListener('click', () => this.closeModal());
        this.muteButton.addEventListener('click', () => this.toggleMute());
    }

    bindKeyboardEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
                this.closeModal();
            }
        });
    }

    toggleMute() {
        if (!this.mediaStream) return;
        this.isMuted = !this.isMuted;
        this.mediaStream.getTracks().forEach(t => t.enabled = !this.isMuted);
        if (this.isMuted) {
            this.setStatus('muted', 'Muted');
            this.muteButton.innerHTML = '<i class="fas fa-microphone mr-2"></i> Unmute';
            this.micButton.classList.remove('animate-pulse-slow');
        } else {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.setStatus('listening', 'Listening… you can start speaking');
            }
            this.muteButton.innerHTML = '<i class="fas fa-microphone-slash mr-2"></i> Mute';
            this.micButton.classList.add('animate-pulse-slow');
        }
    }

    closeModal() {
        this.modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(t => t.stop());
            this.mediaStream = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        }
        // Stop any audio that's playing
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.setStatus('ended', 'Conversation ended');
        this.micButton.classList.remove('animate-pulse-slow');
    }
    // --- END of your existing functions ---


    // --- NEW: Audio playback logic ---
    async playAudio() {
        if (this.isPlaying || this.audioQueue.length === 0) {
            return;
        }
        this.isPlaying = true;
        this.setStatus('speaking', '...'); // AI starts speaking

        const audioData = this.audioQueue.shift();
        const audioBuffer = await this.audioContext.decodeAudioData(audioData);
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(0);

        source.onended = () => {
            this.isPlaying = false;
            // Immediately play the next chunk if available
            this.playAudio(); 
        };
    }
    // --- END NEW ---


    startStreaming(stream) {
        this.socket = new WebSocket(`ws://${location.host}/ws`);

        this.socket.onopen = () => {
            console.log("WebSocket connection opened.");
            this.setStatus('listening', 'Hello! How can I help you book an appointment?');
            this.micButton.classList.add('animate-pulse-slow');

            this.mediaRecorder = new MediaRecorder(stream);
            this.mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0 && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(event.data);
                }
            };
            this.mediaRecorder.start(1000);
        };

        // --- MODIFIED: The core message handler ---
        this.socket.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);
                if (data.action === 'play_thinking_audio') {
                    console.log("Received command: play_thinking_audio");
                    this.setStatus('thinking', 'Okay, let me check on that for you...');
                    this.thinkingAudio.play();
                } else if (data.action === 'end_of_ai_audio') {
                    console.log("Received command: end_of_ai_audio");
                    // When the AI is done talking, go back to listening mode
                    this.setStatus('listening', 'I am listening...');
                }
            } else if (event.data instanceof Blob) {
                // If we receive a Blob, it's an audio chunk from the AI
                const audioData = await event.data.arrayBuffer();
                this.audioQueue.push(audioData);
                if (!this.isPlaying) {
                    this.playAudio();
                }
            }
        };
        // --- END MODIFIED ---

        this.socket.onerror = error => {
            console.error("WebSocket error:", error);
            this.setStatus('error', 'Connection to server failed.');
        };
    }

    async openModalAndRequestMic() {
        this.modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        this.setStatus('waiting', 'Requesting microphone permission…');
        
        // --- NEW: Reset audio context on open ---
        if (this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        // --- END NEW ---

        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.setStatus('connecting', 'Microphone connected. Connecting to server...');
            this.startStreaming(this.mediaStream);

            this.isMuted = false;
            this.muteButton.innerHTML = '<i class="fas fa-microphone-slash mr-2"></i> Mute';
            this.mediaStream.getAudioTracks().forEach(t => t.enabled = true);
        } catch (err) {
            console.error(err);
            this.setStatus('error', 'Microphone access denied.');
        }
    }
}

// Initialize the receptionist when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AIReceptionist();
});