/**
 * Preload Script - Secure bridge between main and renderer
 */

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

// Get the correct assets path
const assetsPath = path.join(__dirname, '../../assets');

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('avatarAPI', {
  // Window detection
  getWindows: () => ipcRenderer.invoke('get-windows'),
  refreshWindows: () => ipcRenderer.invoke('refresh-windows'),
  getTaskbarInfo: () => ipcRenderer.invoke('get-taskbar-info'),

  // Avatar positioning
  getPosition: () => ipcRenderer.invoke('get-avatar-position'),
  setPosition: (x, y) => ipcRenderer.invoke('set-avatar-position', { x, y }),
  getSize: () => ipcRenderer.invoke('get-avatar-size'),
  setSize: (width, height) => ipcRenderer.invoke('set-avatar-size', { width, height }),

  // Screen info
  getScreenInfo: () => ipcRenderer.invoke('get-screen-info'),

  // Window behavior
  setAlwaysOnTop: (value) => ipcRenderer.invoke('set-always-on-top', value),
  setIgnoreMouse: (ignore, options) => ipcRenderer.invoke('set-ignore-mouse', ignore, options),

  // Paths
  assetsPath: assetsPath,
  modelsPath: path.join(assetsPath, 'models'),

  // Platform info
  platform: process.platform
});

// Expose AI API to renderer
contextBridge.exposeInMainWorld('aiAPI', {
  // Configuration
  getConfig: () => ipcRenderer.invoke('ai:get-config'),
  setConfig: (config) => ipcRenderer.invoke('ai:set-config', config),
  healthCheck: () => ipcRenderer.invoke('ai:health-check'),

  // Chat functions
  chat: (message) => ipcRenderer.invoke('ai:chat', message),
  chatText: (message) => ipcRenderer.invoke('ai:chat-text', message),
  processVoice: (audioBase64, mimeType) => ipcRenderer.invoke('ai:process-voice', audioBase64, mimeType),

  // Separate functions
  textToSpeech: (text) => ipcRenderer.invoke('ai:text-to-speech', text),
  speechToText: (audioBase64, mimeType) => ipcRenderer.invoke('ai:speech-to-text', audioBase64, mimeType),

  // Session management
  resetSession: () => ipcRenderer.invoke('ai:reset-session'),

  // Helper: Convert Blob to Base64
  blobToBase64: async (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  // Helper: Play audio from base64
  playAudio: async (audioBase64) => {
    const audioBlob = new Blob(
      [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
      { type: 'audio/mpeg' }
    );
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    await audio.play();
    return audio;
  }
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Desktop Avatar loaded');
  console.log('Assets path:', assetsPath);
  console.log('AI API available:', typeof window.aiAPI !== 'undefined');
});
