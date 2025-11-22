(function (global) {
  "use strict";
  const SHARED = {
    MSG: {
      OPEN_AI_STUDIO: "OPEN_AI_STUDIO",
      TAB_CREATED: "TAB_CREATED",
      TAB_REMOVED: "TAB_REMOVED",
      TAB_ERROR: "TAB_ERROR",
      KEEP_ALIVE: "KEEP_ALIVE",
      LOG: "LOG",
      CONTENT_READY: "CONTENT_READY",
      AUTOMATION_STATUS: "AUTOMATION_STATUS",
      AUTO_DELETE_STATUS: "AUTO_DELETE_STATUS",
      AUDIO_STATUS: "AUDIO_STATUS",
      XHR_EVENT: "XHR_EVENT",
      XHR_READY: "interceptor-ready",
      XHR_REQUEST: "request",
      XHR_THINKING: "thinking-update",
      XHR_STREAMING: "streaming-update",
      XHR_COMPLETE: "complete",
      XHR_ERROR: "error",
      ACTION_PING: "ping",
      ACTION_RUN: "runAutomation",
      ACTION_UPDATE_SETTINGS: "updateSettings",
      ACTION_START_AUDIO: "startAudio",
      ACTION_STOP_AUDIO: "stopAudio",
      ACTION_STOP_AUTOMATION: "stopAutomation",
    },
    STATE: {
      LOADING: "loading",
      READY: "ready",
      ERROR: "error",
    },
    LOG_LEVEL: {
      SUCCESS: "success",
      ERROR: "error",
      INFO: "info",
      WARN: "warn",
      THINK: "think",
      STREAM: "stream",
      NETWORK: "network",
    },
    DEFAULTS: {
      prompt: "This is prompt.",
      model: "gemini-3-pro-preview",
      temperature: 1.6,
      thinkingBudget: 500,
      thinkingLevel: "low",
      topP: 0.4,
      autoAudio: true,
    },
    URL: {
      aiStudio: "https://aistudio.google.com/prompts/new_chat",
      dashboard: "dashboard.html",
    },
    TIMING: {
      focusDelay: 200,
      injectionDelay: 1000,
      keepAliveInterval: 20000,
      autoSaveInterval: 10000,
      healthCheckInterval: 15000,
      pingTimeout: 5000,
      messageRetryCount: 5,
      messageRetryDelay: 700,
      audioRetryMax: 30,
      audioRetryDelay: 300,
      audioInitialDelay: 300,
      cleanupInterval: 300000,
      click: 150,
      optionsClick: 150,
      deleteClick: 150,
      stopProcess: 300,
      panelAction: 200,
      selectDropdown: 300,
      cooldown: 700,
      stateDebounce: 700,
      statePenalty: 1500,
    },
    LIMITS: {
      maxLogsPerTab: 500,
      maxRejects: 3,
      stateTimeout: 60000,
    },
    THINKING_LEVEL_MODELS: ["gemini-3-pro-preview"],
    usesThinkingLevel(model) {
      return this.THINKING_LEVEL_MODELS.includes(model);
    },
  };
  const target =
    typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
      ? window
      : global;
  target.SHARED = SHARED;
})(this);
