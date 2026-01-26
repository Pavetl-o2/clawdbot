/**
 * AI Service - Direct integration with Clawdbot, Deepgram, and ElevenLabs
 *
 * This module handles:
 * - Speech-to-Text (Deepgram)
 * - AI Chat (Clawdbot)
 * - Text-to-Speech (ElevenLabs)
 */

const https = require('https');
const http = require('http');

class AIService {
  constructor(config = {}) {
    // Clawdbot configuration
    this.clawdbotUrl = config.clawdbotUrl || 'http://3.148.106.37:3000';
    this.clawdbotToken = config.clawdbotToken || 'your-secret-token-here';
    this.sessionId = config.sessionId || 'mate-engine';

    // Deepgram configuration
    this.deepgramKey = config.deepgramKey || '';
    this.deepgramModel = config.deepgramModel || 'nova-2-conversationalai';

    // ElevenLabs configuration
    this.elevenLabsKey = config.elevenLabsKey || '';
    this.elevenLabsVoiceId = config.elevenLabsVoiceId || 'k9294w367tNmQIywtFJI'; // Jinx voice
    this.elevenLabsModel = config.elevenLabsModel || 'eleven_flash_v2_5';

    // Voice settings
    this.voiceSettings = config.voiceSettings || {
      stability: 0.55,
      similarity_boost: 0.75,
      speed: 0.85
    };
  }

  /**
   * Make HTTP request (works with both http and https)
   */
  _request(urlString, options, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString);
      const protocol = url.protocol === 'https:' ? https : http;

      const reqOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };

      const req = protocol.request(reqOptions, (res) => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: buffer
          });
        });
      });

      req.on('error', reject);
      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  /**
   * Speech to Text using Deepgram
   * @param {Buffer} audioBuffer - Audio data (WAV, MP3, etc.)
   * @param {string} mimeType - Audio MIME type
   * @returns {Promise<string>} Transcribed text
   */
  async speechToText(audioBuffer, mimeType = 'audio/wav') {
    if (!this.deepgramKey) {
      throw new Error('Deepgram API key not configured');
    }

    const url = `https://api.deepgram.com/v1/listen?model=${this.deepgramModel}&smart_format=true`;

    const response = await this._request(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.deepgramKey}`,
        'Content-Type': mimeType
      }
    }, audioBuffer);

    if (response.status !== 200) {
      throw new Error(`Deepgram error: ${response.status}`);
    }

    const data = JSON.parse(response.body.toString());
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
  }

  /**
   * Chat with Clawdbot
   * @param {string} message - User message
   * @returns {Promise<string>} AI response
   */
  async chat(message) {
    const url = `${this.clawdbotUrl}/chat`;

    const body = JSON.stringify({
      message,
      sessionId: this.sessionId
    });

    const response = await this._request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.clawdbotToken}`
      }
    }, body);

    if (response.status === 401) {
      throw new Error('Clawdbot authentication failed');
    }

    if (response.status !== 200) {
      throw new Error(`Clawdbot error: ${response.status}`);
    }

    const data = JSON.parse(response.body.toString());
    return data.response || '';
  }

  /**
   * Text to Speech using ElevenLabs
   * @param {string} text - Text to convert to speech
   * @returns {Promise<Buffer>} Audio buffer (MP3)
   */
  async textToSpeech(text) {
    if (!this.elevenLabsKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`;

    const body = JSON.stringify({
      text,
      model_id: this.elevenLabsModel,
      voice_settings: this.voiceSettings
    });

    const response = await this._request(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      }
    }, body);

    if (response.status !== 200) {
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    return response.body;
  }

  /**
   * Reset chat session
   * @returns {Promise<boolean>}
   */
  async resetSession() {
    const url = `${this.clawdbotUrl}/session/reset`;

    const body = JSON.stringify({
      sessionId: this.sessionId
    });

    const response = await this._request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.clawdbotToken}`
      }
    }, body);

    return response.status === 200;
  }

  /**
   * Full pipeline: Audio -> Text -> AI -> Audio
   * @param {Buffer} audioBuffer - Input audio
   * @param {string} mimeType - Audio MIME type
   * @returns {Promise<{transcript: string, response: string, audio: Buffer}>}
   */
  async processVoice(audioBuffer, mimeType = 'audio/wav') {
    // Step 1: Speech to Text
    const transcript = await this.speechToText(audioBuffer, mimeType);

    if (!transcript) {
      throw new Error('No speech detected');
    }

    // Step 2: Chat with AI
    const response = await this.chat(transcript);

    if (!response) {
      throw new Error('No response from AI');
    }

    // Step 3: Text to Speech
    const audio = await this.textToSpeech(response);

    return {
      transcript,
      response,
      audio
    };
  }

  /**
   * Text chat pipeline: Text -> AI -> Audio
   * @param {string} text - User text input
   * @returns {Promise<{response: string, audio: Buffer}>}
   */
  async processText(text) {
    // Step 1: Chat with AI
    const response = await this.chat(text);

    if (!response) {
      throw new Error('No response from AI');
    }

    // Step 2: Text to Speech
    const audio = await this.textToSpeech(response);

    return {
      response,
      audio
    };
  }

  /**
   * Check if service is healthy
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      const url = `${this.clawdbotUrl}/health`;
      const response = await this._request(url, { method: 'GET' });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Update configuration
   * @param {object} config - New configuration
   */
  updateConfig(config) {
    if (config.clawdbotUrl) this.clawdbotUrl = config.clawdbotUrl;
    if (config.clawdbotToken) this.clawdbotToken = config.clawdbotToken;
    if (config.sessionId) this.sessionId = config.sessionId;
    if (config.deepgramKey) this.deepgramKey = config.deepgramKey;
    if (config.elevenLabsKey) this.elevenLabsKey = config.elevenLabsKey;
    if (config.elevenLabsVoiceId) this.elevenLabsVoiceId = config.elevenLabsVoiceId;
    if (config.voiceSettings) this.voiceSettings = config.voiceSettings;
  }
}

module.exports = AIService;
