/**
 * AI Chat Example - How to use the AI API in your renderer
 *
 * This file shows example usage of the aiAPI exposed to the renderer.
 * You can integrate these functions into your avatar's UI.
 */

// ============================================
// Configuration
// ============================================

/**
 * Configure AI service (call once on startup)
 */
async function configureAI() {
  await window.aiAPI.setConfig({
    clawdbotUrl: 'http://3.148.106.37:3000',
    clawdbotToken: 'your-secret-token-here',
    sessionId: 'mate-engine',
    deepgramKey: 'your-deepgram-key',
    elevenLabsKey: 'your-elevenlabs-key',
    elevenLabsVoiceId: 'k9294w367tNmQIywtFJI' // Jinx voice
  });
  console.log('AI configured!');
}

/**
 * Check if AI service is working
 */
async function checkAIHealth() {
  const result = await window.aiAPI.healthCheck();
  console.log('AI Health:', result.ok ? 'OK' : 'FAILED');
  return result.ok;
}

// ============================================
// Text Chat
// ============================================

/**
 * Send text message and get audio response
 */
async function sendMessage(text) {
  console.log('Sending:', text);

  const result = await window.aiAPI.chat(text);

  if (result.ok) {
    console.log('Response:', result.response);

    // Play the audio response
    await window.aiAPI.playAudio(result.audio);

    return result.response;
  } else {
    console.error('Error:', result.error);
    return null;
  }
}

/**
 * Send text message and get text-only response (no audio)
 */
async function sendMessageTextOnly(text) {
  const result = await window.aiAPI.chatText(text);

  if (result.ok) {
    return result.response;
  } else {
    console.error('Error:', result.error);
    return null;
  }
}

// ============================================
// Voice Chat
// ============================================

let mediaRecorder = null;
let audioChunks = [];

/**
 * Start recording audio from microphone
 */
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  audioChunks = [];

  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  mediaRecorder.start();
  console.log('Recording started...');
}

/**
 * Stop recording and send to AI
 */
async function stopRecordingAndSend() {
  return new Promise((resolve) => {
    mediaRecorder.onstop = async () => {
      console.log('Recording stopped, processing...');

      // Create blob from chunks
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });

      // Convert to base64
      const audioBase64 = await window.aiAPI.blobToBase64(audioBlob);

      // Send to AI (speech -> text -> AI -> audio)
      const result = await window.aiAPI.processVoice(audioBase64, 'audio/webm');

      if (result.ok) {
        console.log('You said:', result.transcript);
        console.log('AI response:', result.response);

        // Play the audio response
        await window.aiAPI.playAudio(result.audio);

        resolve(result);
      } else {
        console.error('Error:', result.error);
        resolve(null);
      }
    };

    mediaRecorder.stop();

    // Stop all tracks
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  });
}

// ============================================
// Voice Activity Detection (Push-to-Talk)
// ============================================

let isRecording = false;

/**
 * Toggle recording (push-to-talk style)
 */
async function toggleRecording() {
  if (isRecording) {
    isRecording = false;
    const result = await stopRecordingAndSend();
    return result;
  } else {
    isRecording = true;
    await startRecording();
    return null;
  }
}

/**
 * Setup keyboard shortcut for push-to-talk (Space key)
 */
function setupPushToTalk() {
  document.addEventListener('keydown', async (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      if (!isRecording) {
        isRecording = true;
        await startRecording();
        console.log('🎤 Recording...');
      }
    }
  });

  document.addEventListener('keyup', async (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (isRecording) {
        isRecording = false;
        console.log('🔇 Processing...');
        await stopRecordingAndSend();
      }
    }
  });

  console.log('Push-to-talk enabled: Hold SPACE to record');
}

// ============================================
// Session Management
// ============================================

/**
 * Reset chat session (clear memory)
 */
async function resetChat() {
  const result = await window.aiAPI.resetSession();
  if (result.ok) {
    console.log('Chat session reset!');
  }
  return result.ok;
}

// ============================================
// Quick Test
// ============================================

/**
 * Quick test to verify everything works
 */
async function testAI() {
  console.log('Testing AI connection...');

  // Check health
  const healthy = await checkAIHealth();
  if (!healthy) {
    console.error('AI service not reachable!');
    return false;
  }

  // Send test message
  const response = await sendMessage('Hello! Just testing the connection.');
  if (response) {
    console.log('✅ AI test passed!');
    return true;
  } else {
    console.error('❌ AI test failed!');
    return false;
  }
}

// Export functions for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    configureAI,
    checkAIHealth,
    sendMessage,
    sendMessageTextOnly,
    startRecording,
    stopRecordingAndSend,
    toggleRecording,
    setupPushToTalk,
    resetChat,
    testAI
  };
}
