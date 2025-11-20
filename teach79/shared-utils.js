/**
 * Shared utility functions across all extension scripts
 * Compatible with service workers, content scripts, and web pages
 */
(function (global) {
  "use strict";

  const UTILS = {
    // Messaging helpers
    msg: {
      toBackground(type, data = {}) {
        return chrome.runtime.sendMessage({ type, ...data }).catch(() => null);
      },

      toTab(tabId, message, callback) {
        if (!tabId) return;
        chrome.tabs.sendMessage(tabId, message, (response) => {
          if (chrome.runtime.lastError) {
            callback?.(null);
          } else {
            callback?.(response);
          }
        });
      },

      toContent(tabId, action, data = {}) {
        return new Promise((resolve) => {
          UTILS.msg.toTab(tabId, { action, ...data }, resolve);
        });
      },
    },

    // Tab helpers
    tab: {
      exists(tabId) {
        return new Promise((resolve) => {
          chrome.tabs.get(tabId, (tab) => {
            resolve(!chrome.runtime.lastError && !!tab);
          });
        });
      },

      focus(tabId) {
        if (!tabId) return;
        chrome.tabs.update(tabId, { active: true }, (tab) => {
          if (!chrome.runtime.lastError && tab) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      },

      async create(url, active = true) {
        return chrome.tabs.create({ url, active });
      },
    },

    // Error handling
    error: {
      check(context = "Unknown") {
        if (chrome.runtime.lastError) {
          console.error(`[${context}]`, chrome.runtime.lastError.message);
          return true;
        }
        return false;
      },

      async wrap(fn, fallback = null) {
        try {
          return await fn();
        } catch (err) {
          console.error("Operation failed:", err);
          return fallback;
        }
      },
    },

    // Storage helpers (only for non-service worker contexts)
    storage: {
      get(key, defaultValue = null) {
        if (typeof localStorage === "undefined") return defaultValue;
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : defaultValue;
        } catch (err) {
          return defaultValue;
        }
      },

      set(key, value) {
        if (typeof localStorage === "undefined") return false;
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (err) {
          console.error("Storage failed:", err);
          return false;
        }
      },

      remove(key) {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem(key);
        }
      },
    },

    // Time helpers
    time: {
      now() {
        return Date.now();
      },

      elapsed(start) {
        return Date.now() - start;
      },

      format(timestamp) {
        return new Date(timestamp).toLocaleTimeString();
      },

      iso() {
        return new Date().toISOString();
      },
    },

    // Validation
    validate: {
      tabId(id) {
        return typeof id === "number" && id > 0;
      },

      message(msg) {
        return msg && typeof msg === "object" && msg.type;
      },
    },
  };

  // Export to different environments
  if (
    typeof self !== "undefined" &&
    self.constructor.name === "ServiceWorkerGlobalScope"
  ) {
    // Service Worker
    self.UTILS = UTILS;
  } else if (typeof window !== "undefined") {
    // Browser/Content Script
    window.UTILS = UTILS;
  } else if (typeof global !== "undefined") {
    // Node.js (for testing)
    global.UTILS = UTILS;
  }
})(
  typeof self !== "undefined"
    ? self
    : typeof window !== "undefined"
    ? window
    : this
);
