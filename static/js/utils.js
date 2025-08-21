// Utility functions and configurations for SmileCare Dental Clinic

// Tailwind CSS configuration
const tailwindConfig = {
    theme: {
        extend: {
            colors: {
                'dental-blue': '#1e40af',
                'dental-teal': '#0d9488',
                'soft-white': '#f8fafc'
            }
        }
    }
};

// Animation utilities
const AnimationUtils = {
    // Add fade-in animation to elements
    fadeIn: (element, delay = 0) => {
        element.style.animationDelay = `${delay}s`;
        element.classList.add('animate-fade-in-up');
    },

    // Add pulse animation
    pulse: (element) => {
        element.classList.add('animate-pulse-slow');
    },

    // Remove pulse animation
    stopPulse: (element) => {
        element.classList.remove('animate-pulse-slow');
    },

    // Add float animation
    float: (element) => {
        element.classList.add('animate-float');
    }
};

// DOM utilities
const DOMUtils = {
    // Safe element selection with error handling
    getElement: (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
            console.warn(`Element not found: ${selector}`);
        }
        return element;
    },

    // Safe element selection for multiple elements
    getElements: (selector) => {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
            console.warn(`No elements found: ${selector}`);
        }
        return elements;
    },

    // Add event listener with error handling
    addEventListener: (element, event, handler) => {
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn('Cannot add event listener: element is null');
        }
    }
};

// WebSocket utilities
const WebSocketUtils = {
    // Check if WebSocket is supported
    isSupported: () => {
        return typeof WebSocket !== 'undefined';
    },

    // Create WebSocket URL
    createUrl: (path) => {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        return `${protocol}://${location.host}${path}`;
    },

    // Check WebSocket connection status
    getConnectionStatus: (socket) => {
        if (!socket) return 'disconnected';
        
        switch (socket.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'unknown';
        }
    }
};

// Audio utilities
const AudioUtils = {
    // Check if MediaRecorder is supported
    isMediaRecorderSupported: () => {
        return typeof MediaRecorder !== 'undefined';
    },

    // Get supported audio MIME types
    getSupportedMimeTypes: () => {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus'
        ];
        
        return types.filter(type => MediaRecorder.isTypeSupported(type));
    },

    // Get best audio format for recording
    getBestAudioFormat: () => {
        const supportedTypes = AudioUtils.getSupportedMimeTypes();
        return supportedTypes[0] || '';
    }
};

// Browser compatibility utilities
const BrowserUtils = {
    // Check if getUserMedia is supported
    isGetUserMediaSupported: () => {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },

    // Check if browser supports required APIs
    checkCompatibility: () => {
        const issues = [];
        
        if (!WebSocketUtils.isSupported()) {
            issues.push('WebSocket is not supported');
        }
        
        if (!AudioUtils.isMediaRecorderSupported()) {
            issues.push('MediaRecorder is not supported');
        }
        
        if (!BrowserUtils.isGetUserMediaSupported()) {
            issues.push('getUserMedia is not supported');
        }
        
        return {
            isCompatible: issues.length === 0,
            issues: issues
        };
    }
};

// Export utilities for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        tailwindConfig,
        AnimationUtils,
        DOMUtils,
        WebSocketUtils,
        AudioUtils,
        BrowserUtils
    };
}
