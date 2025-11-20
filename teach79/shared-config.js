/**
 * Shared configuration across all extension scripts
 * Compatible with service workers, content scripts, and web pages
 */
(function (global) {
  "use strict";

  const SHARED = {
    // Message Types
    MSG: {
      // Background ↔ Dashboard
      OPEN_AI_STUDIO: "OPEN_AI_STUDIO",
      TAB_REMOVED: "TAB_REMOVED",
      KEEP_ALIVE: "KEEP_ALIVE",

      // Content → Background → Dashboard
      LOG: "LOG",
      CONTENT_READY: "CONTENT_READY",
      AUTOMATION_STATUS: "AUTOMATION_STATUS",
      AUTO_DELETE_STATUS: "AUTO_DELETE_STATUS",
      AUDIO_STATUS: "AUDIO_STATUS",

      // XHR Interceptor → Content → Background → Dashboard
      XHR_EVENT: "XHR_EVENT",
      XHR_READY: "interceptor-ready",
      XHR_REQUEST_DETECTED: "request-detected",
      XHR_REQUEST: "request",
      XHR_THINKING: "thinking-update",
      XHR_STREAMING: "streaming-update",
      XHR_COMPLETE: "complete",
      XHR_ERROR: "error",

      // Dashboard → Content (actions)
      ACTION_PING: "ping",
      ACTION_RUN: "runAutomation",
      ACTION_UPDATE_SETTINGS: "updateSettings",
      ACTION_START_AUDIO: "startAudio",
      ACTION_STOP_AUDIO: "stopAudio",
      ACTION_STOP_AUTOMATION: "stopAutomation",
    },

    // Tab States
    STATE: {
      INITIALIZING: "initializing",
      LOADING: "loading",
      READY: "ready",
      ERROR: "error",
    },

    // Default Settings
    DEFAULTS: {
      prompt: "this is prompt",
      model: "gemini-2.0-flash-thinking-exp",
      temperature: 1.5,
      thinkingBudget: 500,
      topP: 0.5,
      autoAudio: true,
    },

    // URLs
    URL: {
      aiStudio: "https://aistudio.google.com/prompts/new_chat",
      dashboard: "dashboard.html",
    },

    // Timing Constants
    TIMING: {
      // Background
      focusDelay: 100,
      injectionDelay: 1000,
      keepAliveInterval: 20000,

      // Dashboard
      autoSaveInterval: 10000,
      healthCheckInterval: 15000,
      pingTimeout: 5000,
      messageRetryCount: 3,
      messageRetryDelay: 1000,
      audioRetryMax: 3,
      audioRetryDelay: 1500,
      cleanupInterval: 300000,

      // Content
      click: 150,
      optionsClick: 200,
      deleteClick: 150,
      stopProcess: 400,
      panelAction: 250,
      cooldown: 1000,
      stateDebounce: 800,
      statePenalty: 3000,
    },

    // Log Levels
    LOG_LEVEL: {
      SUCCESS: "success",
      ERROR: "error",
      INFO: "info",
      WARN: "warn",
      THINK: "think",
      STREAM: "stream",
      NETWORK: "network",
    },

    // Limits
    LIMITS: {
      maxLogsPerTab: 500,
      maxRejects: 3,
      stateTimeout: 60000,
    },
  };

  // Export to different environments
  if (
    typeof self !== "undefined" &&
    self.constructor.name === "ServiceWorkerGlobalScope"
  ) {
    // Service Worker
    self.SHARED = SHARED;
  } else if (typeof window !== "undefined") {
    // Browser/Content Script
    window.SHARED = SHARED;
  } else if (typeof global !== "undefined") {
    // Node.js (for testing)
    global.SHARED = SHARED;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof window !== "undefined"
    ? window
    : this
);
