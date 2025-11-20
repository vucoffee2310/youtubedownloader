// Import shared configuration
importScripts("shared-config.js", "shared-utils.js");

const state = {
  dashboardTabId: null,
  automationTabIds: new Set(),
};

const tabs = {
  dashboard: {
    open() {
      if (state.dashboardTabId) {
        UTILS.tab.exists(state.dashboardTabId).then((exists) => {
          exists ? UTILS.tab.focus(state.dashboardTabId) : this.create();
        });
      } else {
        this.create();
      }
    },

    create() {
      const url = chrome.runtime.getURL(SHARED.URL.dashboard);
      UTILS.tab.create(url).then((tab) => {
        state.dashboardTabId = tab.id;
        chrome.tabs.onRemoved.addListener(function cleanup(tabId) {
          if (tabId === state.dashboardTabId) {
            state.dashboardTabId = null;
            chrome.tabs.onRemoved.removeListener(cleanup);
          }
        });
      });
    },

    focus() {
      UTILS.tab.focus(state.dashboardTabId);
    },
  },

  automation: {
    async open(model = SHARED.DEFAULTS.model) {
      const url = `${SHARED.URL.aiStudio}?model=${model}`;
      const tab = await UTILS.tab.create(url, false);
      state.automationTabIds.add(tab.id);

      setTimeout(() => tabs.dashboard.focus(), SHARED.TIMING.focusDelay);

      chrome.tabs.onUpdated.addListener(function onLoad(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onLoad);
          setTimeout(
            () => tabs.automation.inject(tab.id),
            SHARED.TIMING.injectionDelay
          );
        }
      });

      return tab.id;
    },

    async inject(tabId) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["shared-config.js", "shared-utils.js", "content.js"],
        });
      } catch (err) {
        console.error("❌ Injection failed:", err);
      }
    },
  },
};

const relay = (message) => {
  UTILS.msg.toTab(state.dashboardTabId, message);
};

// Handlers using SHARED constants
const handlers = {
  [SHARED.MSG.OPEN_AI_STUDIO]: (msg, sender, respond) => {
    tabs.automation
      .open(msg.model || SHARED.DEFAULTS.model)
      .then((tabId) => respond({ success: true, tabId }))
      .catch((err) => respond({ success: false, error: err.message }));
    return true;
  },

  [SHARED.MSG.CONTENT_READY]: (msg, sender, respond) => {
    const tabId = sender.tab?.id;
    if (UTILS.validate.tabId(tabId)) {
      state.automationTabIds.add(tabId);
      relay({ ...msg, tabId });
    }
    respond({ success: true });
  },

  [SHARED.MSG.XHR_EVENT]: (msg, sender, respond) => {
    relay({ ...msg, tabId: sender.tab?.id });
    respond({ success: true });
  },

  [SHARED.MSG.KEEP_ALIVE]: (msg, sender, respond) => {
    respond({ success: true });
  },
};

// Auto-relay messages
[
  SHARED.MSG.LOG,
  SHARED.MSG.AUTOMATION_STATUS,
  SHARED.MSG.AUTO_DELETE_STATUS,
  SHARED.MSG.AUDIO_STATUS,
].forEach((type) => {
  handlers[type] = (msg, sender, respond) => {
    relay(msg);
    respond({ success: true });
  };
});

// Event Listeners
chrome.action.onClicked.addListener(() => tabs.dashboard.open());

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (handlers[msg.type])
    return handlers[msg.type](msg, sender, respond) || true;
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  state.automationTabIds.delete(tabId);
  relay({ type: SHARED.MSG.TAB_REMOVED, tabId });
});

setInterval(() => console.log("💓"), SHARED.TIMING.keepAliveInterval);
