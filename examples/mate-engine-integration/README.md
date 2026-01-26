# Mate-Engine AI Integration Example

This example shows how to integrate Clawdbot into an Electron desktop avatar application (Mate-Engine) with voice and text chat capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Mate-Engine (Electron)                       │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ai-chat-example.js                                          ││
│  │ - configureAI(), sendMessage(), processVoice()              ││
│  │ - Push-to-talk recording                                    ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│                            │ window.aiAPI                        │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ preload.js (contextBridge)                                  ││
│  │ - Exposes aiAPI to renderer                                 ││
│  │ - blobToBase64(), playAudio() helpers                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│                            │ ipcRenderer.invoke()                │
│                            ▼                                     │
│  Main Process                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ai-handlers.js (IPC Handlers)                               ││
│  │ - ai:chat, ai:process-voice, ai:text-to-speech, etc.        ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ai-service.js (AIService class)                             ││
│  │ - speechToText() → Deepgram API                             ││
│  │ - chat() → Clawdbot Server                                  ││
│  │ - textToSpeech() → ElevenLabs API                           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AWS EC2 Server                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ clawdbot-server.js (HTTP wrapper)                           ││
│  │ - POST /chat → executes clawdbot CLI                        ││
│  │ - POST /session/reset                                       ││
│  │ - GET /health                                               ││
│  └─────────────────────────────────────────────────────────────┘│
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Clawdbot CLI                                                ││
│  │ - AI agent with tools and memory                            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Files

### Electron App (src/)

- **`src/main/ai-service.js`** - Core AI service class that handles:
  - Speech-to-Text via Deepgram
  - Chat via Clawdbot HTTP server
  - Text-to-Speech via ElevenLabs

- **`src/main/ai-handlers.js`** - IPC handlers for renderer-main communication

- **`src/preload/preload.js`** - Exposes `window.aiAPI` to renderer securely

- **`src/renderer/ai-chat-example.js`** - Example usage with push-to-talk

### EC2 Server (server/)

- **`server/clawdbot-server.js`** - HTTP wrapper for Clawdbot CLI

## Setup

See `docs/AI-INTEGRATION.md` for complete setup instructions.

## Quick Start

1. **EC2 Server**: Deploy `clawdbot-server.js` to your EC2 instance
2. **Configure**: Set your API keys in the Electron app
3. **Integrate**: Import the AI handlers in your main process

```javascript
// In your main/index.js
const { registerAIHandlers } = require('./ai-handlers');
registerAIHandlers();
```

4. **Use**: Call the API from your renderer

```javascript
// Configure once on startup
await window.aiAPI.setConfig({
  clawdbotUrl: 'http://your-ec2-ip:3000',
  clawdbotToken: 'your-token',
  deepgramKey: 'your-deepgram-key',
  elevenLabsKey: 'your-elevenlabs-key'
});

// Send a message
const result = await window.aiAPI.chat('Hello!');
if (result.ok) {
  console.log('Response:', result.response);
  await window.aiAPI.playAudio(result.audio);
}
```

## API Keys Required

- **Deepgram** - For speech-to-text (https://deepgram.com)
- **ElevenLabs** - For text-to-speech (https://elevenlabs.io)
- **Clawdbot Token** - For authenticating with your Clawdbot server

## License

MIT - See the main Clawdbot repository for license details.
