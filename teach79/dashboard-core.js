const DOM = {
  log: {
    get tableBody() {
      return document.getElementById("logTableBody");
    },
    get badge() {
      return document.getElementById("logsBadge");
    },
  },
  thinking: {
    get body() {
      return document.getElementById("thinkingBody");
    },
    get badge() {
      return document.getElementById("thinkingBadge");
    },
    get copyBtn() {
      return document.getElementById("copyThinking");
    },
  },
  streaming: {
    get body() {
      return document.getElementById("streamingBody");
    },
    get badge() {
      return document.getElementById("streamingBadge");
    },
    get copyBtn() {
      return document.getElementById("copyStreaming");
    },
  },
  tabs: {
    get container() {
      return document.getElementById("connectedTabsContainer");
    },
    get stats() {
      return document.getElementById("xhrStats");
    },
    get newBtn() {
      return document.getElementById("newTabBtn");
    },
  },
  settings: {
    get modal() {
      return document.getElementById("settingsModal");
    },
    get tabId() {
      return document.getElementById("editTabId");
    },
    get prompt() {
      return document.getElementById("promptInput");
    },
    get promptLength() {
      return document.getElementById("promptLength");
    },
    get model() {
      return document.getElementById("modelSelect");
    },
    get temperature() {
      return document.getElementById("temperatureInput");
    },
    get budget() {
      return document.getElementById("budgetInput");
    },
    get topP() {
      return document.getElementById("topPInput");
    },
    get autoAudio() {
      return document.getElementById("autoAudioCheckbox");
    },
    get saveBtn() {
      return document.getElementById("saveSettingsBtn");
    },
    get resetBtn() {
      return document.getElementById("resetSettingsBtn");
    },
    get closeBtn() {
      return document.getElementById("closeSettings");
    },
  },
};

const state = {
  tabInstances: new Map(),
  tabSequentialIds: new Map(),
  contentCaches: new Map(),
  tabHealth: new Map(),
  preferredActiveTabId: null,
  editingTabId: null,
  nextSequentialId: 1,
  isRestoring: true,
  _audioSaveTimeout: null,
  _isSaving: false,
  _audioStarting: new Set(),
  intervals: { health: null, autoSave: null },
  recentlyClosedTabs: new Set(),
  userCreatedTabs: new Set(),
};

const getActiveTabId = () => {
  if (
    state.preferredActiveTabId &&
    state.tabInstances.has(state.preferredActiveTabId)
  ) {
    return state.preferredActiveTabId;
  }
  if (state.tabInstances.size > 0) {
    return Array.from(state.tabInstances.keys())[0];
  }
  return null;
};

const setActiveTabId = (tabId) => {
  if (!tabId || !state.tabInstances.has(tabId)) {
    console.warn(`⚠️ Cannot set invalid tab as active: ${tabId}`);
    return false;
  }
  state.preferredActiveTabId = tabId;
  console.log(`✅ Active tab preference: ${tabId}`);
  return true;
};

const createXHRData = () => ({
  thinkingChunks: 0,
  thinkingChars: 0,
  thinkingText: "",
  streamingChunks: 0,
  streamingChars: 0,
  streamingText: "",
  duration: 0,
  model: "-",
});

const createContentCache = () => ({
  thinking: { container: null, pre: null, cursor: null },
  streaming: { container: null, pre: null, cursor: null },
});

const createTabInstance = () => ({
  ...SHARED.DEFAULTS,
  audio: false,
  state: SHARED.STATE.LOADING,
  logs: [],
  xhrData: createXHRData(),
  thinkingLevel: SHARED.DEFAULTS.thinkingLevel,
});

const STATE_INFO = {
  [SHARED.STATE.LOADING]: {
    icon: "",
    spinner: true,
  },
  [SHARED.STATE.READY]: {
    icon: "🟢",
    spinner: false,
  },
  [SHARED.STATE.ERROR]: {
    icon: "❌",
    spinner: false,
  },
};

const HEALTH_INFO = {
  healthy: "🟢",
  degraded: "🟡",
  dead: "🔴",
};

const ICONS = {
  settings: "⚙️",
  run: "▶️",
  audioOn: "🔇",
  audioOff: "🔊",
  save: "💾",
  clear: "🗑️",
  close: "×",
  thinking: "🤔",
  streaming: "✨",
  logs: "📋",
};

const EMPTY_STATES = {
  logs: { icon: ICONS.logs, text: "No logs yet" },
  thinking: { icon: ICONS.thinking, text: "No thinking data yet" },
  streaming: { icon: ICONS.streaming, text: "No streaming data yet" },
  noTab: { icon: ICONS.logs, text: "No tab selected" },
};

const getSequentialId = (chromeTabId) => {
  if (state.isRestoring && !state.tabSequentialIds.has(chromeTabId))
    return "...";
  if (!state.tabSequentialIds.has(chromeTabId)) {
    state.tabSequentialIds.set(chromeTabId, state.nextSequentialId++);
  }
  return state.tabSequentialIds.get(chromeTabId);
};

const getTabInstance = (tabId) => {
  if (!state.tabInstances.has(tabId)) {
    if (state.isRestoring) return null;
    const instance = createTabInstance();
    state.tabInstances.set(tabId, instance);
    state.contentCaches.set(tabId, createContentCache());
    state.tabHealth.set(tabId, {
      lastPing: UTILS.time.now(),
      status: "healthy",
    });
    getSequentialId(tabId);
    saveTabInstances();
    return instance;
  }
  return state.tabInstances.get(tabId);
};

const getHealthIcon = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance) return "⚪";
  if (instance.state === SHARED.STATE.LOADING) return "";
  if (instance.state === SHARED.STATE.ERROR) return "❌";
  const health = state.tabHealth.get(tabId);
  return HEALTH_INFO[health?.status] || "🟢";
};

const renderEmptyState = (type = "noTab") => {
  const { icon, text } = EMPTY_STATES[type];
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
};

// ✅ CENTRALIZED UPDATE FUNCTION
const updateTab = (tabId, updates) => {
  if (state.recentlyClosedTabs.has(tabId)) {
    console.log(`⛔ Ignoring update for recently closed tab ${tabId}`);
    return false;
  }

  const instance = getTabInstance(tabId);
  if (!instance) return false;

  Object.assign(instance, updates);

  if (!state.isRestoring) {
    renderUI();
    saveTabInstances();
  }

  return true;
};

const saveTabInstances = () => {
  if (state._isSaving || state.isRestoring) return;
  state._isSaving = true;
  try {
    const data = {};
    const seqIds = {};
    state.tabInstances.forEach((instance, tabId) => {
      data[tabId] = {
        ...instance,
        logs: instance.logs.slice(-SHARED.LIMITS.maxLogsPerTab),
      };
      seqIds[tabId] = state.tabSequentialIds.get(tabId);
    });
    UTILS.storage.set("dashboardState", {
      version: 3,
      timestamp: UTILS.time.now(),
      tabInstances: data,
      tabSequentialIds: { ids: seqIds, next: state.nextSequentialId },
      preferredActiveTabId: state.preferredActiveTabId,
    });
  } finally {
    state._isSaving = false;
  }
};

const restoreTabInstances = () => {
  console.log("🔄 Restoring...");
  try {
    const dashboardState = UTILS.storage.get("dashboardState");
    if (!dashboardState?.tabInstances) {
      console.log("📦 No saved state");
      state.isRestoring = false;
      renderUI();
      return;
    }
    const data = dashboardState.tabInstances;
    const savedSeqIds = dashboardState.tabSequentialIds;
    const tabIdsToRestore = Object.keys(data).map(Number);
    if (tabIdsToRestore.length === 0) {
      console.log("📦 No tabs");
      state.isRestoring = false;
      renderUI();
      return;
    }
    console.log(`📦 Checking ${tabIdsToRestore.length} tabs...`);
    Promise.all(
      tabIdsToRestore.map((tabId) =>
        UTILS.tab.exists(tabId).then((exists) => ({ tabId, exists }))
      )
    )
      .then((results) => {
        const validTabs = results.filter((r) => r.exists);
        console.log(`✅ Valid: ${validTabs.length}`);
        if (validTabs.length === 0) {
          console.log("⚠️ No valid tabs");
          state.isRestoring = false;
          renderUI();
          return;
        }
        if (savedSeqIds?.ids) {
          validTabs.forEach(({ tabId }) => {
            if (savedSeqIds.ids[tabId]) {
              state.tabSequentialIds.set(tabId, savedSeqIds.ids[tabId]);
            }
          });
          const maxSeqId = Math.max(
            ...Array.from(state.tabSequentialIds.values()),
            0
          );
          state.nextSequentialId = Math.max(
            maxSeqId + 1,
            savedSeqIds.next || 1
          );
        }
        validTabs.forEach(({ tabId }) => {
          const saved = data[tabId];
          state.tabInstances.set(tabId, {
            ...createTabInstance(),
            ...saved,
            logs: saved.logs || [],
            xhrData: saved.xhrData || createXHRData(),
            thinkingLevel: saved.thinkingLevel || SHARED.DEFAULTS.thinkingLevel,
          });
          state.contentCaches.set(tabId, createContentCache());
          state.tabHealth.set(tabId, {
            lastPing: UTILS.time.now(),
            status: "healthy",
          });
        });
        state.preferredActiveTabId =
          dashboardState.preferredActiveTabId || null;
        const activeTabId = getActiveTabId();
        console.log(
          `✅ Active: ${activeTabId} (preferred: ${state.preferredActiveTabId})`
        );
        state.isRestoring = false;
        renderUI();
      })
      .catch((err) => {
        console.error("❌ Restoration error:", err);
        state.isRestoring = false;
        renderUI();
      });
  } catch (err) {
    console.error("❌ Failed to restore:", err);
    state.isRestoring = false;
    renderUI();
  }
};

const renderUI = () => {
  if (state.isRestoring) return;
  console.log(
    `🎨 Rendering (${
      state.tabInstances.size
    } tabs, active: ${getActiveTabId()})`
  );
  updateTabsUI();
  renderActiveTab();
};

// ✅ RECONCILIATION - Verify tabs still exist
const reconcileState = () => {
  if (state.isRestoring || state.tabInstances.size === 0) return;

  const tabIds = Array.from(state.tabInstances.keys());
  console.log(`🔄 Reconciling ${tabIds.length} tabs...`);

  Promise.all(
    tabIds.map((tabId) =>
      UTILS.tab.exists(tabId).then((exists) => ({ tabId, exists }))
    )
  ).then((results) => {
    const staleTabs = results.filter((r) => !r.exists);
    if (staleTabs.length > 0) {
      console.log(`🗑️ Removing ${staleTabs.length} stale tabs`);
      staleTabs.forEach(({ tabId }) => removeTab(tabId));
    }
  });
};

const cleanupStaleData = () => {
  reconcileState();
};

const sendMessageToTab = (tabId, message, callback, retryCount = 0) => {
  if (!UTILS.validate.tabId(tabId)) return callback?.(null);
  const safeCallback = UTILS.createSafeCallback(callback);
  const absoluteTimeout = setTimeout(() => {
    updateTabHealth(tabId, "dead");
    safeCallback?.(null);
  }, 10000);
  UTILS.tab
    .exists(tabId)
    .then((exists) => {
      clearTimeout(absoluteTimeout);
      if (!exists) {
        updateTabHealth(tabId, "dead");
        removeTab(tabId);
        return safeCallback?.(null);
      }
      UTILS.msg.toTab(tabId, message, (response) => {
        if (response === null && retryCount < SHARED.TIMING.messageRetryCount) {
          setTimeout(
            () =>
              sendMessageToTab(tabId, message, safeCallback, retryCount + 1),
            SHARED.TIMING.messageRetryDelay * (retryCount + 1)
          );
        } else {
          updateTabHealth(tabId, response ? "healthy" : "degraded");
          safeCallback?.(response);
        }
      });
    })
    .catch(() => {
      clearTimeout(absoluteTimeout);
      removeTab(tabId);
      safeCallback?.(null);
    });
};

const updateTabHealth = (tabId, status) => {
  if (state.isRestoring) return;
  state.tabHealth.set(tabId, { lastPing: UTILS.time.now(), status });
  updateTabsUI();
};

const pingTab = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance || instance.state !== SHARED.STATE.READY) return;
  const startTime = UTILS.time.now();
  let timeoutFired = false;
  const timeoutId = setTimeout(() => {
    timeoutFired = true;
    updateTabHealth(tabId, "dead");
  }, SHARED.TIMING.pingTimeout);
  sendMessageToTab(tabId, { action: SHARED.MSG.ACTION_PING }, (response) => {
    clearTimeout(timeoutId);
    if (!timeoutFired) {
      const latency = UTILS.time.elapsed(startTime);
      updateTabHealth(
        tabId,
        response?.pong ? (latency > 2000 ? "degraded" : "healthy") : "degraded"
      );
    }
  });
};

const startMonitoring = (type, fn, interval) => {
  if (state.intervals[type]) return;
  state.intervals[type] = setInterval(fn, interval);
};

const stopMonitoring = (type) => {
  if (state.intervals[type]) {
    clearInterval(state.intervals[type]);
    state.intervals[type] = null;
  }
};

const startHealthMonitoring = () => {
  if (state.isRestoring) return setTimeout(startHealthMonitoring, 500);
  startMonitoring(
    "health",
    () => state.tabInstances.forEach((_, id) => pingTab(id)),
    SHARED.TIMING.healthCheckInterval
  );
};

const stopHealthMonitoring = () => stopMonitoring("health");

const startAutoSave = () =>
  startMonitoring("autoSave", saveTabInstances, SHARED.TIMING.autoSaveInterval);

const stopAutoSave = () => stopMonitoring("autoSave");
