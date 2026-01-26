# AI Integration Guide - Mate-Engine + Clawdbot

This guide explains how to integrate Clawdbot directly into Mate-Engine without n8n.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MATE-ENGINE (Electron)                     │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Renderer   │───▶│   Preload   │───▶│    Main Process     │ │
│  │  (UI/3D)    │    │   (Bridge)  │    │    (ai-service.js)  │ │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘ │
│                                                    │            │
└────────────────────────────────────────────────────┼────────────┘
                                                     │
                    ┌────────────────────────────────┼────────────┐
                    │                                │            │
                    ▼                                ▼            ▼
            ┌───────────────┐              ┌─────────────┐ ┌───────────┐
            │   CLAWDBOT    │              │  DEEPGRAM   │ │ ELEVENLABS│
            │   (EC2)       │              │   (STT)     │ │   (TTS)   │
            └───────────────┘              └─────────────┘ └───────────┘
```

## Setup Instructions

### 1. Setup Clawdbot Server on EC2

Copy `server/clawdbot-server.js` to your EC2 instance:

```bash
# On EC2
mkdir ~/clawdbot-api
cd ~/clawdbot-api

# Copy the file (or use scp from your local machine)
nano clawdbot-server.js
# Paste the content

# Set your secret token
export AUTH_TOKEN="your-secret-token-here"

# Run the server
node clawdbot-server.js

# Or use PM2 for production
npm install -g pm2
pm2 start clawdbot-server.js --name clawdbot-api
pm2 save
pm2 startup
```

Open port 3000 in your EC2 Security Group.

### 2. Update Mate-Engine main process

Add this to your `src/main/index.js`:

```javascript
// Add at the top
const { registerAIHandlers } = require('./ai-handlers');

// Add after app.whenReady()
app.whenReady().then(() => {
  registerAIHandlers();  // Add this line
  initialize();
});
```

### 3. Update package.json

The preload.js now uses `contextBridge`, so update your BrowserWindow options:

```javascript
webPreferences: {
  contextIsolation: true,  // Change to true
  nodeIntegration: false,  // Change to false
  preload: path.join(__dirname, '../preload/preload.js')
}
```

### 4. Configure API Keys

On first run, configure your API keys from the renderer:

```javascript
await window.aiAPI.setConfig({
  clawdbotUrl: 'http://YOUR_EC2_IP:3000',
  clawdbotToken: 'your-secret-token-here',
  deepgramKey: 'your-deepgram-api-key',
  elevenLabsKey: 'your-elevenlabs-api-key',
  elevenLabsVoiceId: 'your-voice-id'  // Optional, defaults to Jinx
});
```

## Usage

### Text Chat

```javascript
// Send message and get audio response
const result = await window.aiAPI.chat('Hello Jinx!');
if (result.ok) {
  console.log('Response:', result.response);
  await window.aiAPI.playAudio(result.audio);
}
```

### Voice Chat

```javascript
// Record audio and get response
const result = await window.aiAPI.processVoice(audioBase64, 'audio/webm');
if (result.ok) {
  console.log('You said:', result.transcript);
  console.log('AI said:', result.response);
  await window.aiAPI.playAudio(result.audio);
}
```

### Push-to-Talk Example

See `src/renderer/ai-chat-example.js` for a complete push-to-talk implementation.

## API Reference

### Configuration

| Method | Description |
|--------|-------------|
| `aiAPI.getConfig()` | Get current configuration |
| `aiAPI.setConfig(config)` | Update configuration |
| `aiAPI.healthCheck()` | Check if Clawdbot is reachable |

### Chat

| Method | Description |
|--------|-------------|
| `aiAPI.chat(message)` | Send text, get text + audio response |
| `aiAPI.chatText(message)` | Send text, get text-only response |
| `aiAPI.processVoice(audioBase64, mimeType)` | Full voice pipeline |

### Individual Functions

| Method | Description |
|--------|-------------|
| `aiAPI.speechToText(audioBase64, mimeType)` | Convert audio to text |
| `aiAPI.textToSpeech(text)` | Convert text to audio |
| `aiAPI.resetSession()` | Clear chat memory |

### Helpers

| Method | Description |
|--------|-------------|
| `aiAPI.playAudio(audioBase64)` | Play audio from base64 string |
| `aiAPI.blobToBase64(blob)` | Convert Blob to base64 string |

## Costs

| Service | Free Tier | Paid |
|---------|-----------|------|
| Clawdbot (EC2 t3.small) | - | ~$15/month |
| Deepgram | 200 hours/month | $0.0043/min |
| ElevenLabs | 10,000 chars/month | $5+/month |

## Troubleshooting

### "AI service not reachable"
- Check EC2 is running
- Verify port 3000 is open in Security Group
- Check clawdbot-server.js is running

### "Clawdbot authentication failed"
- Verify AUTH_TOKEN matches on both server and client

### No audio response
- Check ElevenLabs API key is valid
- Verify voice ID exists

### Speech not recognized
- Check Deepgram API key is valid
- Ensure audio format is supported (webm, wav, mp3)
