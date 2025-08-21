// AI Receptionist JavaScript
// Handles voice-to-text functionality, WebSocket connections, and modal interactions

class AIReceptionist {
    constructor() {
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
        this.audioContext = null;
        this.workletNode = null;
        this.streamSource = null;
        
        this.init();
    }

    init() {
        // Bind event listeners
        this.bindBookButtons();
        this.bindModalEvents();
        this.bindKeyboardEvents();
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

    setStatus(state, text) {
        const colors = {
            waiting: 'bg-yellow-400',
            listening: 'bg-green-500',
            muted: 'bg-gray-400',
            error: 'bg-red-500',
            ended: 'bg-gray-400',
            connecting: 'bg-blue-400',
        };
        this.statusDot.className = `inline-flex h-3 w-3 rounded-full ${colors[state] || 'bg-gray-400'}`;
        this.statusText.textContent = text;
    }

    async startStreamingPCM(stream) {
        const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://${location.host}/ws`;
        this.socket = new WebSocket(wsUrl);
        try { this.socket.binaryType = 'arraybuffer'; } catch (e) {}

        this.socket.onopen = async () => {
            console.log("WebSocket connection opened (PCM mode).");
            this.setStatus('listening', 'Listening… you can start speaking');
            this.micButton.classList.add('animate-pulse-slow');

            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
                await this.audioContext.audioWorklet.addModule('/static/js/pcm-worklet.js');
                this.streamSource = this.audioContext.createMediaStreamSource(stream);
                this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-downsampler');
                this.workletNode.port.onmessage = (event) => {
                    const socket = this.socket;
                    if (!socket || socket.readyState !== WebSocket.OPEN) return;
                    socket.send(event.data);
                };
                this.streamSource.connect(this.workletNode);
                this.workletNode.connect(this.audioContext.destination);
            } catch (err) {
                console.error('AudioWorklet init failed, falling back to MediaRecorder:', err);
                this.startStreamingMediaRecorder(stream);
            }
        };

        this.socket.onerror = error => {
            console.error("WebSocket error:", error);
            this.setStatus('error', 'Connection to server failed.');
        };

        // No transcript UI roundtrip anymore; Portia forwarding happens server-side
        this.socket.onmessage = null;

        this.socket.onclose = () => {
            console.log("WebSocket connection closed.");
            if (this.mediaRecorder) {
                this.mediaRecorder.stop();
            }
            if (this.workletNode) {
                try { this.workletNode.disconnect(); } catch {}
                this.workletNode = null;
            }
            if (this.streamSource) {
                try { this.streamSource.disconnect(); } catch {}
                this.streamSource = null;
            }
            if (this.audioContext) {
                try { this.audioContext.close(); } catch {}
                this.audioContext = null;
            }
            this.socket = null;
        };
    }

    startStreamingMediaRecorder(stream) {
        const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const wsUrl = `${wsProtocol}://${location.host}/ws`;
        this.socket = new WebSocket(wsUrl);
        try { this.socket.binaryType = 'arraybuffer'; } catch (e) {}

        this.socket.onopen = () => {
            console.log("WebSocket connection opened.");
            this.setStatus('listening', 'Listening… you can start speaking');
            this.micButton.classList.add('animate-pulse-slow');

            if (typeof MediaRecorder === 'undefined') {
                this.setStatus('error', 'MediaRecorder is not supported in this browser.');
                return;
            }

            let recorderOptions = {};
            if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
                recorderOptions = { mimeType: 'audio/ogg;codecs=opus' };
            } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                recorderOptions = { mimeType: 'audio/webm;codecs=opus' };
            }
            this.mediaRecorder = new MediaRecorder(stream, recorderOptions);

            this.mediaRecorder.ondataavailable = async (event) => {
                if (!event.data || event.data.size === 0) return;
                const socket = this.socket;
                if (!socket || socket.readyState !== WebSocket.OPEN) return;
                try {
                    const buf = await event.data.arrayBuffer();
                    socket.send(buf);
                } catch (err) {
                    console.error('Failed to send audio chunk:', err);
                }
            };

            this.mediaRecorder.start(250);
        };

        this.socket.onerror = error => {
            console.error("WebSocket error:", error);
            this.setStatus('error', 'Connection to server failed.');
        };

        this.socket.onmessage = null;

        this.socket.onclose = () => {
            console.log("WebSocket connection closed.");
            if (this.mediaRecorder) {
                this.mediaRecorder.stop();
            }
            this.socket = null;
        };
    }

    async openModalAndRequestMic() {
        this.modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
        this.setStatus('waiting', 'Requesting microphone permission…');

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Microphone API not supported in this browser.');
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.setStatus('connecting', 'Microphone connected. Connecting to server...');

            // Prefer low-latency PCM via AudioWorklet when supported
            if (window.AudioWorkletNode) {
                await this.startStreamingPCM(this.mediaStream);
            } else {
                this.startStreamingMediaRecorder(this.mediaStream);
            }

            this.isMuted = false;
            this.muteButton.innerHTML = '<i class="fas fa-microphone-slash mr-2"></i> Mute';
            this.mediaStream.getAudioTracks().forEach(t => t.enabled = true);

        } catch (err) {
            console.error(err);
            this.setStatus('error', 'Microphone access denied. Please enable it in your browser settings.');
            this.micButton.classList.remove('animate-pulse-slow');
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
        if (this.workletNode) {
            try { this.workletNode.disconnect(); } catch {}
            this.workletNode = null;
        }
        if (this.streamSource) {
            try { this.streamSource.disconnect(); } catch {}
            this.streamSource = null;
        }
        if (this.audioContext) {
            try { this.audioContext.close(); } catch {}
            this.audioContext = null;
        }

        this.setStatus('ended', 'Conversation ended');
        this.micButton.classList.remove('animate-pulse-slow');
    }

    toggleMute() {
        if (!this.mediaStream) return;
        
        this.isMuted = !this.isMuted;
        this.mediaStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
        
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
}

// Initialize AI Receptionist when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    new AIReceptionist();
});
