let dashboardTabId = null;
let automationTabIds = new Set();

const tabs = {
  dashboard: {
    open() {
      if (dashboardTabId) {
        chrome.tabs.get(dashboardTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            this.create();
          } else {
            chrome.tabs.update(dashboardTabId, { active: true });
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      } else {
        this.create();
      }
    },
    create() {
      chrome.tabs.create(
        { url: chrome.runtime.getURL("dashboard.html") },
        (tab) => {
          dashboardTabId = tab.id;
          chrome.tabs.onRemoved.addListener(function cleanup(tabId) {
            if (tabId === dashboardTabId) {
              dashboardTabId = null;
              chrome.tabs.onRemoved.removeListener(cleanup);
            }
          });
        }
      );
    },
    focus() {
      if (dashboardTabId) {
        chrome.tabs.update(dashboardTabId, { active: true }, (tab) => {
          if (!chrome.runtime.lastError && tab) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      }
    },
  },
  automation: {
    async open(model = "gemini-2.0-flash-thinking-exp") {
      const url = `https://aistudio.google.com/prompts/new_chat?model=${model}`;
      const tab = await chrome.tabs.create({ url, active: false });
      automationTabIds.add(tab.id);
      setTimeout(() => tabs.dashboard.focus(), 100);
      chrome.tabs.onUpdated.addListener(function onLoad(tabId, info) {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onLoad);
          setTimeout(() => tabs.automation.inject(tab.id), 1000);
        }
      });
      return tab.id;
    },
    async inject(tabId) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ["content.js"],
        });
      } catch (err) {
        console.error("❌ Injection failed:", err);
      }
    },
  },
};

const relay = (message) => {
  if (dashboardTabId) {
    chrome.tabs.sendMessage(dashboardTabId, message).catch(() => {});
  }
};

const handlers = {
  OPEN_AI_STUDIO: (msg, sender, respond) => {
    const model = msg.model || "gemini-2.0-flash-thinking-exp";
    tabs.automation
      .open(model)
      .then((tabId) => respond({ success: true, tabId }))
      .catch((err) => {
        console.error("❌ Failed to open AI Studio:", err);
        respond({
          success: false,
          error: err.message || "Tab creation failed",
        });
      });
    return true;
  },
  LOG: (msg, sender, respond) => {
    relay(msg);
    respond({ success: true });
  },
  AUTOMATION_STATUS: (msg, sender, respond) => {
    relay(msg);
    respond({ success: true });
  },
  AUTO_DELETE_STATUS: (msg, sender, respond) => {
    relay(msg);
    respond({ success: true });
  },
  AUDIO_STATUS: (msg, sender, respond) => {
    relay(msg);
    respond({ success: true });
  },
  CONTENT_READY: (msg, sender, respond) => {
    const tabId = sender.tab?.id;
    if (tabId) {
      automationTabIds.add(tabId);
      relay({ ...msg, tabId });
    }
    respond({ success: true });
  },
  XHR_EVENT: (msg, sender, respond) => {
    const tabId = sender.tab?.id;
    relay({ ...msg, tabId });
    respond({ success: true });
  },
  KEEP_ALIVE: (msg, sender, respond) => {
    respond({ success: true });
  },
};

chrome.action.onClicked.addListener(tabs.dashboard.open.bind(tabs.dashboard));

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const handler = handlers[msg.type];
  if (handler) handler(msg, sender, respond);
  return true;
});

// Global tab removal handler
chrome.tabs.onRemoved.addListener((tabId) => {
  if (automationTabIds.has(tabId)) {
    automationTabIds.delete(tabId);
  }
  relay({ type: "TAB_REMOVED", tabId });
});

setInterval(() => console.log("💓"), 20000);
