# JavaScript Files Organization

This directory contains all the JavaScript files for the SmileCare Dental Clinic website, organized for better maintainability and code separation.

## File Structure

```
static/js/
├── README.md           # This documentation file
├── utils.js           # Utility functions and configurations
├── main.js            # Main navigation and UI interactions
└── ai-receptionist.js # AI receptionist functionality
```

## File Descriptions

### `utils.js`
Contains utility functions and configurations used across the application:
- **Tailwind CSS configuration** - Custom color definitions
- **AnimationUtils** - Helper functions for CSS animations
- **DOMUtils** - Safe DOM manipulation utilities
- **WebSocketUtils** - WebSocket connection helpers
- **AudioUtils** - Audio recording and format utilities
- **BrowserUtils** - Browser compatibility checks

### `main.js`
Handles the main website functionality:
- **Smooth scrolling** for navigation links
- **Navigation effects** (scroll-based styling)
- **Mobile menu** functionality
- **General UI interactions**

### `ai-receptionist.js`
Manages the AI receptionist feature:
- **WebSocket connections** for real-time communication
- **Audio recording** and streaming
- **Modal management** for the AI interface
- **Microphone permissions** and controls
- **Status management** and user feedback

## Usage

The JavaScript files are loaded in the following order in `templates/index.html`:

```html
<script src="/static/js/utils.js"></script>
<script src="/static/js/main.js"></script>
<script src="/static/js/ai-receptionist.js"></script>
```

## Key Features

### AI Receptionist Class
The `AIReceptionist` class provides a clean, object-oriented approach to managing:
- WebSocket connections
- Audio streaming
- Modal interactions
- Error handling

### Utility Functions
Common utilities are available globally for use across all modules:
- `AnimationUtils.fadeIn(element, delay)`
- `DOMUtils.getElement(selector)`
- `WebSocketUtils.createUrl(path)`
- `AudioUtils.getBestAudioFormat()`

### Browser Compatibility
The code includes comprehensive browser compatibility checks and fallbacks for:
- WebSocket support
- MediaRecorder API
- getUserMedia API
- Audio format support

## Development Guidelines

1. **Keep functions focused** - Each function should have a single responsibility
2. **Use error handling** - Always check for element existence and API support
3. **Maintain separation of concerns** - Keep UI logic separate from business logic
4. **Add comments** - Document complex functions and important decisions
5. **Test browser compatibility** - Use the provided utility functions for checks

## Future Enhancements

Potential improvements for the JavaScript architecture:
- **Module bundling** with Webpack or Rollup
- **TypeScript** for better type safety
- **Unit testing** with Jest or similar
- **State management** for complex UI states
- **Service workers** for offline functionality
