importScripts("shared-config.js", "shared-utils.js");
const state = {
  dashboardTabId: null,
  automationTabIds: new Set(),
};
const listeners = {
  dashboardCleanup: null,
  automationCleanups: new Map(),
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
      UTILS.tab
        .create(chrome.runtime.getURL(SHARED.URL.dashboard))
        .then((tab) => {
          if (listeners.dashboardCleanup) {
            chrome.tabs.onRemoved.removeListener(listeners.dashboardCleanup);
          }
          state.dashboardTabId = tab.id;
          listeners.dashboardCleanup = (tabId) => {
            if (tabId === state.dashboardTabId) {
              state.dashboardTabId = null;
              chrome.tabs.onRemoved.removeListener(listeners.dashboardCleanup);
              listeners.dashboardCleanup = null;
            }
          };
          chrome.tabs.onRemoved.addListener(listeners.dashboardCleanup);
        });
    },
  },
  automation: {
    async open(model = SHARED.DEFAULTS.model) {
      const url = `${SHARED.URL.aiStudio}?model=${model}`;
      const tab = await UTILS.tab.create(url, false);
      state.automationTabIds.add(tab.id);
      setTimeout(
        () => UTILS.tab.focus(state.dashboardTabId),
        SHARED.TIMING.focusDelay
      );
      relay({
        type: SHARED.MSG.TAB_CREATED,
        tabId: tab.id,
      });
      const onLoad = (tabId, info) => {
        if (tabId === tab.id && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(onLoad);
          UTILS.tab.exists(tab.id).then((exists) => {
            if (exists) {
              setTimeout(
                () => this.inject(tab.id),
                SHARED.TIMING.injectionDelay
              );
            } else {
              console.warn(`Tab ${tab.id} closed before injection`);
              listeners.automationCleanups.delete(tab.id);
            }
          });
        }
      };
      chrome.tabs.onUpdated.addListener(onLoad);
      listeners.automationCleanups.set(tab.id, onLoad);
      return tab.id;
    },
    async inject(tabId) {
      try {
        if (!(await UTILS.tab.exists(tabId))) {
          console.warn(`Tab ${tabId} no longer exists`);
          return;
        }
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            "shared-config.js",
            "shared-utils.js",
            "content-core.js",
            "content-init.js",
          ],
        });
        console.log(`✅ Scripts injected into tab ${tabId}`);
      } catch (err) {
        console.error(`❌ Injection failed for tab ${tabId}:`, err.message);
        UTILS.msg.toTab(state.dashboardTabId, {
          type: SHARED.MSG.TAB_ERROR,
          tabId,
          error: `Injection failed: ${err.message}`,
        });
      }
    },
  },
};
const relay = (message) => UTILS.msg.toTab(state.dashboardTabId, message);
const handlers = {
  [SHARED.MSG.OPEN_AI_STUDIO]: (msg, sender, respond) => {
    tabs.automation
      .open(msg.model || SHARED.DEFAULTS.model)
      .then((tabId) => respond({ success: !!tabId, tabId }))
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
chrome.action.onClicked.addListener(() => tabs.dashboard.open());
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  const handler = handlers[msg.type];
  return handler ? handler(msg, sender, respond) || true : true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  state.automationTabIds.delete(tabId);
  const listener = listeners.automationCleanups.get(tabId);
  if (listener) {
    chrome.tabs.onUpdated.removeListener(listener);
    listeners.automationCleanups.delete(tabId);
  }
  relay({ type: SHARED.MSG.TAB_REMOVED, tabId });
});
setInterval(() => console.log("💓"), SHARED.TIMING.keepAliveInterval);
