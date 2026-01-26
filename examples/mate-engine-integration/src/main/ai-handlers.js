/**
 * AI IPC Handlers
 *
 * Add these handlers to your main process to enable AI communication
 * from the renderer process.
 *
 * Usage in index.js:
 *   const { registerAIHandlers } = require('./ai-handlers');
 *   registerAIHandlers();
 */

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const AIService = require('./ai-service');

// AI Service instance
let aiService = null;

// Config file path
const aiConfigPath = path.join(app.getPath('userData'), 'ai-config.json');

/**
 * Load AI configuration
 */
function loadAIConfig() {
  try {
    if (fs.existsSync(aiConfigPath)) {
      const data = fs.readFileSync(aiConfigPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading AI config:', error);
  }
  return {};
}

/**
 * Save AI configuration
 */
function saveAIConfig(config) {
  try {
    // Don't save sensitive keys in plain text in production!
    // This is for development convenience only
    const safeConfig = { ...config };
    fs.writeFileSync(aiConfigPath, JSON.stringify(safeConfig, null, 2));
  } catch (error) {
    console.error('Error saving AI config:', error);
  }
}

/**
 * Get or create AI service instance
 */
function getAIService() {
  if (!aiService) {
    const config = loadAIConfig();
    aiService = new AIService(config);
  }
  return aiService;
}

/**
 * Register all AI-related IPC handlers
 */
function registerAIHandlers() {
  // ============================================
  // AI Configuration
  // ============================================

  /**
   * Get current AI configuration (without sensitive keys)
   */
  ipcMain.handle('ai:get-config', async () => {
    const config = loadAIConfig();
    return {
      clawdbotUrl: config.clawdbotUrl || 'http://3.148.106.37:3000',
      sessionId: config.sessionId || 'mate-engine',
      hasDeepgramKey: !!config.deepgramKey,
      hasElevenLabsKey: !!config.elevenLabsKey,
      hasClawdbotToken: !!config.clawdbotToken,
      elevenLabsVoiceId: config.elevenLabsVoiceId || 'k9294w367tNmQIywtFJI'
    };
  });

  /**
   * Update AI configuration
   */
  ipcMain.handle('ai:set-config', async (event, config) => {
    const currentConfig = loadAIConfig();
    const newConfig = { ...currentConfig, ...config };
    saveAIConfig(newConfig);

    // Update running service
    const service = getAIService();
    service.updateConfig(newConfig);

    return { ok: true };
  });

  /**
   * Check if AI service is healthy
   */
  ipcMain.handle('ai:health-check', async () => {
    try {
      const service = getAIService();
      const healthy = await service.healthCheck();
      return { ok: healthy };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  // ============================================
  // AI Chat
  // ============================================

  /**
   * Send text message and get response + audio
   */
  ipcMain.handle('ai:chat', async (event, message) => {
    try {
      const service = getAIService();
      const result = await service.processText(message);
      return {
        ok: true,
        response: result.response,
        audio: result.audio.toString('base64')
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  /**
   * Send text message and get text response only (no TTS)
   */
  ipcMain.handle('ai:chat-text', async (event, message) => {
    try {
      const service = getAIService();
      const response = await service.chat(message);
      return { ok: true, response };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  /**
   * Process voice input: audio -> text -> AI -> audio
   */
  ipcMain.handle('ai:process-voice', async (event, audioBase64, mimeType) => {
    try {
      const service = getAIService();
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const result = await service.processVoice(audioBuffer, mimeType);
      return {
        ok: true,
        transcript: result.transcript,
        response: result.response,
        audio: result.audio.toString('base64')
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  /**
   * Convert text to speech only
   */
  ipcMain.handle('ai:text-to-speech', async (event, text) => {
    try {
      const service = getAIService();
      const audio = await service.textToSpeech(text);
      return {
        ok: true,
        audio: audio.toString('base64')
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  /**
   * Convert speech to text only
   */
  ipcMain.handle('ai:speech-to-text', async (event, audioBase64, mimeType) => {
    try {
      const service = getAIService();
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      const transcript = await service.speechToText(audioBuffer, mimeType);
      return { ok: true, transcript };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  /**
   * Reset chat session
   */
  ipcMain.handle('ai:reset-session', async () => {
    try {
      const service = getAIService();
      await service.resetSession();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  });

  console.log('AI handlers registered');
}

module.exports = { registerAIHandlers, getAIService };
