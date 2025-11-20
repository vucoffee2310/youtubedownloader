/* global SHARED, UTILS */

const $ = (id) => document.getElementById(id);

// DOM Elements
const DOM = {
  log: {
    tableBody: $("logTableBody"),
    badge: $("logsBadge"),
  },
  thinking: {
    body: $("thinkingBody"),
    badge: $("thinkingBadge"),
    copyBtn: $("copyThinking"),
  },
  streaming: {
    body: $("streamingBody"),
    badge: $("streamingBadge"),
    copyBtn: $("copyStreaming"),
  },
  tabs: {
    container: $("connectedTabsContainer"),
    stats: $("xhrStats"),
    newBtn: $("newTabBtn"),
  },
  settings: {
    modal: $("settingsModal"),
    tabId: $("editTabId"),
    prompt: $("promptInput"),
    promptLength: $("promptLength"),
    model: $("modelSelect"),
    temperature: $("temperatureInput"),
    budget: $("budgetInput"),
    topP: $("topPInput"),
    autoAudio: $("autoAudioCheckbox"),
    saveBtn: $("saveSettingsBtn"),
    resetBtn: $("resetSettingsBtn"),
    closeBtn: $("closeSettings"),
  },
};

// State
const state = {
  tabInstances: new Map(),
  tabSequentialIds: new Map(),
  contentCaches: new Map(),
  tabHealth: new Map(),
  placeholderChips: new Map(),
  activeTabId: null,
  editingTabId: null,
  nextSequentialId: 1,
  nextPlaceholderId: 1,
  intervals: {
    health: null,
    autoSave: null,
  },
};

// Data Structures - Single source of truth
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
  state: SHARED.STATE.INITIALIZING,
  logs: [],
  xhrData: createXHRData(),
});

// Lookups - Single source of truth
const STATE_INFO = {
  [SHARED.STATE.INITIALIZING]: { icon: "⏳", label: "initializing..." },
  [SHARED.STATE.LOADING]: { icon: "🔄", label: "loading...", spinner: true },
  [SHARED.STATE.READY]: { icon: "🟢", label: "" },
  [SHARED.STATE.ERROR]: { icon: "❌", label: "error" },
};

const HEALTH_INFO = {
  healthy: "🟢",
  degraded: "🟡",
  dead: "🔴",
  initializing: "⏳",
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

const CONTENT_TYPES = {
  thinking: {
    stateKey: "thinking",
    countKey: "thinkingCount",
    msgType: SHARED.MSG.XHR_THINKING,
  },
  streaming: {
    stateKey: "streaming",
    countKey: "streamingCount",
    msgType: SHARED.MSG.XHR_STREAMING,
  },
};

// Utilities
const getSequentialId = (chromeTabId) => {
  if (!state.tabSequentialIds.has(chromeTabId)) {
    state.tabSequentialIds.set(chromeTabId, state.nextSequentialId++);
  }
  return state.tabSequentialIds.get(chromeTabId);
};

const getTabInstance = (tabId) => {
  if (!state.tabInstances.has(tabId)) {
    const instance = createTabInstance();
    state.tabInstances.set(tabId, instance);
    state.contentCaches.set(tabId, createContentCache());
    state.tabHealth.set(tabId, {
      lastPing: UTILS.time.now(),
      status: "initializing",
    });
    getSequentialId(tabId);
    saveTabInstances();
    return instance;
  }
  return state.tabInstances.get(tabId);
};

const getHealthIcon = (tabId) => {
  const instance = getTabInstance(tabId);
  const stateInfo = STATE_INFO[instance.state];
  if (stateInfo && instance.state !== SHARED.STATE.READY) return stateInfo.icon;
  const health = state.tabHealth.get(tabId);
  return HEALTH_INFO[health?.status] || "⚪";
};

const renderEmptyState = (type = "noTab") => {
  const { icon, text } = EMPTY_STATES[type];
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-text">${text}</div></div>`;
};

// Storage
const saveTabInstances = () => {
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
    UTILS.storage.set("tabInstances", data);
    UTILS.storage.set("tabSequentialIds", {
      ids: seqIds,
      next: state.nextSequentialId,
    });
    console.log("✅ Auto-saved tab instances");
  } catch (err) {
    console.error("❌ Failed to save tab instances:", err);
  }
};

const restoreTabInstances = () => {
  try {
    const data = UTILS.storage.get("tabInstances");
    const savedSeqIds = UTILS.storage.get("tabSequentialIds");
    if (!data) return;

    const tabIdsToRestore = Object.keys(data).map((id) => parseInt(id));
    if (tabIdsToRestore.length === 0)
      return console.log("📦 No tabs to restore");

    console.log(`📦 Attempting to restore ${tabIdsToRestore.length} tabs...`);

    Promise.all(
      tabIdsToRestore.map((tabId) =>
        UTILS.tab.exists(tabId).then((exists) => ({ tabId, exists }))
      )
    ).then((results) => {
      const validTabs = results.filter((r) => r.exists);
      const invalidTabs = results.filter((r) => !r.exists);

      if (savedSeqIds?.ids) {
        validTabs.forEach(({ tabId }) => {
          if (savedSeqIds.ids[tabId]) {
            state.tabSequentialIds.set(tabId, savedSeqIds.ids[tabId]);
          }
        });
        const maxSeqId = Math.max(
          0,
          ...Array.from(state.tabSequentialIds.values())
        );
        state.nextSequentialId = maxSeqId + 1;
        console.log(`🔢 Sequential ID counter: ${state.nextSequentialId}`);
      }

      validTabs.forEach(({ tabId }) => {
        const saved = data[tabId];
        state.tabInstances.set(tabId, {
          ...createTabInstance(),
          ...saved,
          logs: saved.logs || [],
          xhrData: saved.xhrData || createXHRData(),
        });
        state.contentCaches.set(tabId, createContentCache());
        state.tabHealth.set(tabId, {
          lastPing: UTILS.time.now(),
          status: "healthy",
        });
        if (state.activeTabId === null) state.activeTabId = tabId;
      });

      if (validTabs.length > 0)
        console.log(`✅ Restored ${validTabs.length} tab(s)`);
      if (invalidTabs.length > 0) {
        console.log(`🗑️ Cleaned up ${invalidTabs.length} stale tab(s)`);
        saveTabInstances();
      }

      setTimeout(() => {
        renderActiveTab();
        updateTabsUI();
      }, 500);
    });
  } catch (err) {
    console.error("❌ Failed to restore tab instances:", err);
    UTILS.storage.remove("tabInstances");
    UTILS.storage.remove("tabSequentialIds");
  }
};

const cleanupStaleData = () => {
  const currentTabIds = Array.from(state.tabInstances.keys());
  if (currentTabIds.length === 0) return console.log("✅ No tabs to check");

  Promise.all(
    currentTabIds.map((tabId) =>
      UTILS.tab.exists(tabId).then((exists) => ({ tabId, exists }))
    )
  ).then((results) => {
    const staleTabs = results.filter((r) => !r.exists);
    if (staleTabs.length === 0) return console.log("✅ No stale tabs found");
    staleTabs.forEach(({ tabId }) => {
      console.warn(`🗑️ Removing stale tab ${tabId}`);
      removeTab(tabId);
    });
    console.log(`🧹 Cleaned up ${staleTabs.length} stale tab(s)`);
    saveTabInstances();
  });
};

// Messaging
const sendMessageToTab = (tabId, message, callback, retryCount = 0) => {
  if (!UTILS.validate.tabId(tabId)) return;
  UTILS.tab.exists(tabId).then((exists) => {
    if (!exists) {
      console.warn(`Tab ${tabId} not found`);
      updateTabHealth(tabId, "dead");
      return removeTab(tabId);
    }
    UTILS.msg.toTab(tabId, message, (response) => {
      if (response === null) {
        if (retryCount < SHARED.TIMING.messageRetryCount) {
          setTimeout(
            () => sendMessageToTab(tabId, message, callback, retryCount + 1),
            SHARED.TIMING.messageRetryDelay * (retryCount + 1)
          );
        } else {
          updateTabHealth(tabId, "degraded");
        }
      } else {
        updateTabHealth(tabId, "healthy");
        callback?.(response);
      }
    });
  });
};

// Health Monitoring
const updateTabHealth = (tabId, status) => {
  state.tabHealth.set(tabId, { lastPing: UTILS.time.now(), status });
  updateTabsUI();
};

const pingTab = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== SHARED.STATE.READY) return;
  const startTime = UTILS.time.now();
  const timeoutId = setTimeout(
    () => updateTabHealth(tabId, "dead"),
    SHARED.TIMING.pingTimeout
  );
  sendMessageToTab(tabId, { action: SHARED.MSG.ACTION_PING }, (response) => {
    clearTimeout(timeoutId);
    const latency = UTILS.time.elapsed(startTime);
    updateTabHealth(
      tabId,
      response?.pong ? (latency > 2000 ? "degraded" : "healthy") : "degraded"
    );
  });
};

const startMonitoring = (type, fn, interval) => {
  if (state.intervals[type]) return;
  state.intervals[type] = setInterval(fn, interval);
  console.log(`${type === "health" ? "🏥" : "💾"} ${type} monitoring started`);
};

const stopMonitoring = (type) => {
  if (state.intervals[type]) {
    clearInterval(state.intervals[type]);
    state.intervals[type] = null;
    console.log(
      `${type === "health" ? "🏥" : "💾"} ${type} monitoring stopped`
    );
  }
};

const startHealthMonitoring = () =>
  startMonitoring(
    "health",
    () => state.tabInstances.forEach((_, id) => pingTab(id)),
    SHARED.TIMING.healthCheckInterval
  );
const stopHealthMonitoring = () => stopMonitoring("health");
const startAutoSave = () =>
  startMonitoring("autoSave", saveTabInstances, SHARED.TIMING.autoSaveInterval);
const stopAutoSave = () => stopMonitoring("autoSave");

// Tab Management
const addTab = (tabId, tabState = SHARED.STATE.INITIALIZING) => {
  if (!state.tabInstances.has(tabId)) {
    getTabInstance(tabId).state = tabState;
    if (state.activeTabId === null) {
      state.activeTabId = tabId;
      renderActiveTab();
    }
    updateTabsUI();
    const seqId = getSequentialId(tabId);
    addLogToTab(tabId, SHARED.LOG_LEVEL.INFO, `Tab #${seqId} ${tabState}`, {
      name: "TabManager",
    });
  }
};

const updateTabState = (tabId, tabState) => {
  const instance = getTabInstance(tabId);
  instance.state = tabState;
  const stateInfo = STATE_INFO[tabState];
  addLogToTab(
    tabId,
    tabState === SHARED.STATE.ERROR
      ? SHARED.LOG_LEVEL.ERROR
      : SHARED.LOG_LEVEL.SUCCESS,
    `${stateInfo.icon} ${tabState}`,
    { name: "TabManager" }
  );
  updateTabsUI();
  saveTabInstances();
};

const removeTab = (tabId) => {
  if (state.tabInstances.has(tabId)) {
    state.tabInstances.delete(tabId);
    state.contentCaches.delete(tabId);
    state.tabHealth.delete(tabId);
    state.tabSequentialIds.delete(tabId);
    if (state.activeTabId === tabId) {
      const remainingTabs = Array.from(state.tabInstances.keys());
      state.activeTabId = remainingTabs.length > 0 ? remainingTabs[0] : null;
      renderActiveTab();
    }
    updateTabsUI();
    saveTabInstances();
  }
};

const setActiveTab = (tabId) => {
  if (state.tabInstances.has(tabId)) {
    state.activeTabId = tabId;
    renderActiveTab();
    updateTabsUI();
  }
};

// Settings Modal
const openSettings = (tabId) => {
  const instance = getTabInstance(tabId);
  state.editingTabId = tabId;
  DOM.settings.tabId.textContent = getSequentialId(tabId);
  DOM.settings.prompt.value = instance.prompt;
  DOM.settings.promptLength.textContent = `${instance.prompt.length} chars`;
  DOM.settings.model.value = instance.model;
  DOM.settings.temperature.value = instance.temperature;
  DOM.settings.budget.value = instance.thinkingBudget;
  DOM.settings.topP.value = instance.topP;
  DOM.settings.autoAudio.checked = instance.autoAudio;
  DOM.settings.modal.classList.add("active");
};

const closeSettings = () => {
  state.editingTabId = null;
  DOM.settings.modal.classList.remove("active");
};

const saveSettings = () => {
  if (state.editingTabId === null) return;
  const instance = getTabInstance(state.editingTabId);
  Object.assign(instance, {
    prompt: DOM.settings.prompt.value,
    model: DOM.settings.model.value,
    temperature: parseFloat(DOM.settings.temperature.value),
    thinkingBudget: parseInt(DOM.settings.budget.value),
    topP: parseFloat(DOM.settings.topP.value),
    autoAudio: DOM.settings.autoAudio.checked,
  });
  addLogToTab(
    state.editingTabId,
    SHARED.LOG_LEVEL.SUCCESS,
    "Settings updated",
    { name: "Settings" }
  );
  updateTabsUI();
  saveTabInstances();
  DOM.settings.saveBtn.textContent = "✅ Saved!";
  setTimeout(() => {
    DOM.settings.saveBtn.textContent = "💾 Save Settings";
    closeSettings();
  }, 1000);
};

const resetSettings = () => {
  if (
    !confirm("Reset this tab to default settings?") ||
    state.editingTabId === null
  )
    return;
  DOM.settings.prompt.value = SHARED.DEFAULTS.prompt;
  DOM.settings.model.value = SHARED.DEFAULTS.model;
  DOM.settings.temperature.value = SHARED.DEFAULTS.temperature;
  DOM.settings.budget.value = SHARED.DEFAULTS.thinkingBudget;
  DOM.settings.topP.value = SHARED.DEFAULTS.topP;
  DOM.settings.autoAudio.checked = SHARED.DEFAULTS.autoAudio;
  DOM.settings.promptLength.textContent = `${SHARED.DEFAULTS.prompt.length} chars`;
};

// Quick Actions
const runTabAutomation = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== SHARED.STATE.READY) {
    return addLogToTab(
      tabId,
      SHARED.LOG_LEVEL.WARN,
      `Cannot run: tab is ${instance.state}`,
      { name: "QuickRun" }
    );
  }
  const { prompt, model, temperature, thinkingBudget, topP } = instance;
  addLogToTab(
    tabId,
    SHARED.LOG_LEVEL.INFO,
    `Running: "${prompt.substring(0, 50)}${prompt.length > 50 ? "..." : ""}"`,
    { name: "QuickRun" }
  );
  sendMessageToTab(tabId, {
    action: SHARED.MSG.ACTION_RUN,
    settings: { prompt, model, temperature, thinkingBudget, topP },
  });
};

const toggleTabAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== SHARED.STATE.READY) {
    return addLogToTab(
      tabId,
      SHARED.LOG_LEVEL.WARN,
      `Cannot toggle audio: tab is ${instance.state}`,
      { name: "QuickAudio" }
    );
  }
  const action = instance.audio
    ? SHARED.MSG.ACTION_STOP_AUDIO
    : SHARED.MSG.ACTION_START_AUDIO;
  sendMessageToTab(tabId, { action }, (response) => {
    if (response?.success) {
      instance.audio = !instance.audio;
      updateTabsUI();
      saveTabInstances();
      addLogToTab(
        tabId,
        SHARED.LOG_LEVEL.INFO,
        `Audio ${instance.audio ? "started" : "stopped"}`,
        { name: "QuickAudio" }
      );
    }
  });
};

const saveTabLogs = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.logs.length === 0) {
    return addLogToTab(tabId, SHARED.LOG_LEVEL.WARN, "No logs to save", {
      name: "QuickSave",
    });
  }
  const seqId = getSequentialId(tabId);
  let text = `AI Studio Automator - Tab #${seqId} Logs\nGenerated: ${new Date().toLocaleString()}\n${"=".repeat(
    80
  )}\n\n`;
  text +=
    "Time        Function              Duration    Message\n" +
    "-".repeat(80) +
    "\n";
  instance.logs.forEach((e) => {
    text += `${e.time.padEnd(12)}${e.function.padEnd(22)}${e.duration.padStart(
      11
    )}    ${e.message}\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = `logs-tab${seqId}-${Date.now()}.txt`;
  a.click();
  addLogToTab(
    tabId,
    SHARED.LOG_LEVEL.SUCCESS,
    `Saved ${instance.logs.length} logs`,
    { name: "QuickSave" }
  );
};

const clearTabData = (tabId) => {
  const seqId = getSequentialId(tabId);
  if (!confirm(`Clear all data for Tab #${seqId}? This cannot be undone.`))
    return;
  const instance = getTabInstance(tabId);
  instance.logs = [];
  instance.xhrData = createXHRData();
  const cache = state.contentCaches.get(tabId);
  if (cache) Object.assign(cache, createContentCache());
  if (state.activeTabId === tabId) renderActiveTab();
  saveTabInstances();
  addLogToTab(tabId, SHARED.LOG_LEVEL.INFO, "Data cleared", {
    name: "Dashboard",
  });
  updateTabsUI();
};

// Chip Actions
const CHIP_ACTIONS = {
  settings: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && openSettings(tabId),
  run: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && runTabAutomation(tabId),
  audio: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && toggleTabAudio(tabId),
  save: (tabId) => saveTabLogs(tabId),
  clear: (tabId) => clearTabData(tabId),
  close: (tabId) =>
    chrome.tabs.remove(
      tabId,
      () => chrome.runtime.lastError && removeTab(tabId)
    ),
};

const createChipActions = (tabId, instance) => {
  const actions = ["settings", "run", "audio", "save", "clear"];
  const isReady = instance.state === SHARED.STATE.READY;
  return actions
    .map((action) => {
      const icon =
        action === "audio"
          ? instance.audio
            ? ICONS.audioOn
            : ICONS.audioOff
          : ICONS[action];
      const disabled =
        !isReady && ["settings", "run", "audio"].includes(action)
          ? "disabled"
          : "";
      return `<button class="tab-chip-action ${action}" data-tab-id="${tabId}" title="${action}" ${disabled}>${icon}</button>`;
    })
    .join("");
};

// UI Rendering
const updateTabsUI = () => {
  if (state.tabInstances.size === 0) {
    DOM.tabs.container.innerHTML =
      '<span style="color: var(--text-muted); font-size: 0.75rem;">No tabs connected</span>';
    return;
  }
  DOM.tabs.container.innerHTML = "";
  Array.from(state.tabInstances.keys())
    .sort((a, b) => getSequentialId(a) - getSequentialId(b))
    .forEach((tabId) => {
      const instance = state.tabInstances.get(tabId);
      const seqId = getSequentialId(tabId);
      const chip = document.createElement("div");
      const stateInfo = STATE_INFO[instance.state];
      const promptPreview =
        instance.prompt.length > 20
          ? instance.prompt.substring(0, 20) + "..."
          : instance.prompt;
      const spinner = stateInfo.spinner
        ? '<span class="tab-chip-spinner"></span>'
        : "";

      chip.className = `tab-chip ${
        instance.state === SHARED.STATE.READY ? "ready" : instance.state
      } ${state.activeTabId === tabId ? "active" : ""}`;
      chip.innerHTML = `
        <div class="tab-chip-main">
          <span class="tab-chip-id">${spinner}${getHealthIcon(
        tabId
      )} #${seqId}</span>
          <span class="tab-chip-prompt">${promptPreview}</span>
          ${
            stateInfo.label
              ? `<span class="tab-chip-status">${stateInfo.label}</span>`
              : ""
          }
        </div>
        <div class="tab-chip-actions">
          ${createChipActions(tabId, instance)}
          <span class="tab-chip-audio-indicator ${
            instance.audio ? "on" : ""
          }"></span>
          <button class="tab-chip-action close" data-tab-id="${tabId}" title="Close tab">${
        ICONS.close
      }</button>
        </div>
        ${
          instance.logs.length > 0
            ? `<span class="tab-chip-badge">${instance.logs.length}</span>`
            : ""
        }
      `;

      chip.onclick = (e) =>
        !["BUTTON", "SPAN"].includes(e.target.tagName) && setActiveTab(tabId);
      Object.keys(CHIP_ACTIONS).forEach((action) => {
        chip.querySelector(`.${action}`)?.addEventListener("click", (e) => {
          e.stopPropagation();
          CHIP_ACTIONS[action](tabId, instance);
        });
      });
      DOM.tabs.container.appendChild(chip);
    });
};

const renderActiveTab = () => {
  if (state.activeTabId === null) {
    DOM.log.tableBody.innerHTML = `<tr><td colspan="4">${renderEmptyState(
      "noTab"
    )}</td></tr>`;
    DOM.thinking.body.innerHTML = renderEmptyState("noTab");
    DOM.streaming.body.innerHTML = renderEmptyState("noTab");
    DOM.log.badge.textContent = "0";
    DOM.thinking.badge.textContent = "0";
    DOM.streaming.badge.textContent = "0";
    return;
  }
  const instance = getTabInstance(state.activeTabId);
  renderLogs(instance.logs);
  renderXHRData(instance.xhrData);
  renderContent(
    state.activeTabId,
    "thinking",
    instance.xhrData.thinkingText,
    false
  );
  renderContent(
    state.activeTabId,
    "streaming",
    instance.xhrData.streamingText,
    false
  );
};

const renderLogs = (logs) => {
  if (logs.length === 0) {
    DOM.log.tableBody.innerHTML = `<tr><td colspan="4">${renderEmptyState(
      "logs"
    )}</td></tr>`;
    DOM.log.badge.textContent = "0";
    return;
  }
  DOM.log.tableBody.innerHTML = logs
    .map(
      (log) =>
        `<tr class="log-row ${log.level}"><td class="log-time">${log.time}</td><td class="log-fn">${log.function}</td><td class="log-dur">${log.duration}</td><td class="log-msg">${log.message}</td></tr>`
    )
    .join("");
  DOM.log.badge.textContent = logs.length;
  const container = DOM.log.tableBody.closest(".log-container");
  container &&
    requestAnimationFrame(() => (container.scrollTop = container.scrollHeight));
};

const renderXHRData = (xhrData) => {
  DOM.thinking.badge.textContent = xhrData.thinkingChunks;
  DOM.streaming.badge.textContent = xhrData.streamingChunks;
  [
    "thinkingChunks",
    "thinkingChars",
    "streamingChunks",
    "streamingChars",
    "durationMs",
    "requestModel",
  ].forEach((id) => {
    const el = $(id);
    if (el) {
      el.textContent =
        id === "thinkingChars" || id === "streamingChars"
          ? xhrData[id.replace("Chars", "Chars")].toLocaleString()
          : id === "durationMs"
          ? xhrData.duration + "ms"
          : id === "requestModel"
          ? xhrData.model
          : xhrData[id];
    }
  });
};

const renderContent = (tabId, type, text, isComplete = false) => {
  const bodyContainer =
    type === "thinking" ? DOM.thinking.body : DOM.streaming.body;
  const cache = state.contentCaches.get(tabId)?.[type];
  if (!cache) return;
  if (!text) {
    bodyContainer.innerHTML = renderEmptyState(type);
    Object.assign(cache, { container: null, pre: null, cursor: null });
    return;
  }
  const isAtBottom =
    bodyContainer.scrollHeight -
      bodyContainer.scrollTop -
      bodyContainer.clientHeight <=
    150;
  if (!cache.container) {
    bodyContainer.innerHTML = "";
    cache.container = document.createElement("div");
    cache.container.className = "response-content";
    cache.pre = document.createElement("pre");
    cache.container.appendChild(cache.pre);
    cache.cursor = document.createElement("span");
    cache.cursor.className = "live-cursor";
    bodyContainer.appendChild(cache.container);
  }
  cache.pre.textContent = text;
  isComplete
    ? cache.cursor.remove()
    : !cache.cursor.parentNode && cache.container.appendChild(cache.cursor);
  isAtBottom &&
    requestAnimationFrame(
      () => (bodyContainer.scrollTop = bodyContainer.scrollHeight)
    );
};

// Logging
const addLogToTab = (tabId, level, msg, meta = {}) => {
  const instance = getTabInstance(tabId);
  instance.logs.push({
    time: UTILS.time.format(UTILS.time.now()),
    level,
    function: meta.name || "-",
    duration: meta.duration ? `${meta.duration.toFixed(1)}ms` : "-",
    message: msg,
  });
  if (instance.logs.length > SHARED.LIMITS.maxLogsPerTab) {
    instance.logs = instance.logs.slice(-SHARED.LIMITS.maxLogsPerTab);
  }
  state.activeTabId === tabId ? renderLogs(instance.logs) : updateTabsUI();
};

// Audio
const tryAutoStartAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (
    !instance.autoAudio ||
    instance.audio ||
    instance.state !== SHARED.STATE.READY
  )
    return;

  addLogToTab(tabId, SHARED.LOG_LEVEL.INFO, "Auto-starting audio...", {
    name: "Audio",
  });
  let attempts = 0;
  const attemptStart = () => {
    attempts++;
    sendMessageToTab(
      tabId,
      { action: SHARED.MSG.ACTION_START_AUDIO },
      (response) => {
        if (response?.success || response?.alreadyActive) {
          instance.audio = true;
          updateTabsUI();
          saveTabInstances();
          addLogToTab(
            tabId,
            response.alreadyActive
              ? SHARED.LOG_LEVEL.INFO
              : SHARED.LOG_LEVEL.SUCCESS,
            response.alreadyActive
              ? "Audio already active"
              : `Audio started (attempt ${attempts})`,
            { name: "Audio" }
          );
        } else if (attempts < SHARED.TIMING.audioRetryMax) {
          setTimeout(attemptStart, 1000 * attempts);
        } else {
          addLogToTab(
            tabId,
            SHARED.LOG_LEVEL.WARN,
            `Audio auto-start failed after ${SHARED.TIMING.audioRetryMax} attempts`,
            {
              name: "Audio",
            }
          );
        }
      }
    );
  };
  setTimeout(attemptStart, SHARED.TIMING.audioRetryDelay);
};

// Stats
const updateStatsVisibility = (activeTab) => {
  DOM.tabs.stats.classList.remove("active");
  if (state.activeTabId === null) return;
  const instance = getTabInstance(state.activeTabId);
  const statsConfig = {
    thinking: [
      {
        label: "Chunks",
        value: instance.xhrData.thinkingChunks,
        id: "thinkingChunks",
      },
      {
        label: "Characters",
        value: instance.xhrData.thinkingChars.toLocaleString(),
        id: "thinkingChars",
      },
      { label: "Model", value: instance.xhrData.model, id: "requestModel" },
    ],
    streaming: [
      {
        label: "Chunks",
        value: instance.xhrData.streamingChunks,
        id: "streamingChunks",
      },
      {
        label: "Characters",
        value: instance.xhrData.streamingChars.toLocaleString(),
        id: "streamingChars",
      },
      {
        label: "Duration",
        value: instance.xhrData.duration + "ms",
        id: "durationMs",
      },
      { label: "Model", value: instance.xhrData.model, id: "requestModel" },
    ],
  };
  const stats = statsConfig[activeTab];
  if (stats) {
    DOM.tabs.stats.classList.add("active");
    DOM.tabs.stats.innerHTML = stats
      .map(
        (s) =>
          `<div class="stat"><span class="stat-label">${s.label}</span><span class="stat-value" id="${s.id}">${s.value}</span></div>`
      )
      .join("");
  }
};

// Placeholder Management
const createPlaceholder = () => {
  const id = `placeholder-${state.nextPlaceholderId++}`;
  const chip = document.createElement("div");
  chip.className = "tab-chip initializing";
  chip.setAttribute("data-placeholder-id", id);
  chip.innerHTML = `
    <div class="tab-chip-main">
      <span class="tab-chip-id"><span class="tab-chip-spinner"></span>⏳ #...</span>
      <span class="tab-chip-prompt">Opening...</span>
      <span class="tab-chip-status">initializing...</span>
    </div>
    <div class="tab-chip-actions">
      ${createChipActions(null, { state: SHARED.STATE.INITIALIZING })}
      <span class="tab-chip-audio-indicator"></span>
      <button class="tab-chip-action close" disabled title="Close tab">${
        ICONS.close
      }</button>
    </div>
  `;
  state.placeholderChips.set(id, chip);
  return { id, chip };
};

const updatePlaceholder = (id, tabState, text) => {
  const chip = state.placeholderChips.get(id);
  if (!chip) return;
  const stateInfo = STATE_INFO[tabState];
  chip.className = `tab-chip ${tabState}`;
  const spinner = stateInfo.spinner
    ? '<span class="tab-chip-spinner"></span>'
    : "";
  chip.querySelector(
    ".tab-chip-id"
  ).innerHTML = `${spinner}${stateInfo.icon} #...`;
  chip.querySelector(".tab-chip-prompt").textContent = text;
  chip.querySelector(".tab-chip-status").textContent = stateInfo.label;
};

const removePlaceholder = (id) => {
  const chip = state.placeholderChips.get(id);
  chip?.remove();
  state.placeholderChips.delete(id);
};

// Modal Handlers
DOM.settings.closeBtn.onclick = closeSettings;
DOM.settings.modal.onclick = (e) =>
  e.target === DOM.settings.modal && closeSettings();
document.onkeydown = (e) => e.key === "Escape" && closeSettings();
DOM.settings.prompt.oninput = () =>
  (DOM.settings.promptLength.textContent = `${DOM.settings.prompt.value.length} chars`);
DOM.settings.saveBtn.onclick = saveSettings;
DOM.settings.resetBtn.onclick = resetSettings;

// Theme
const savedTheme = UTILS.storage.get("theme", "dark");
savedTheme === "light" && document.body.classList.add("light-theme");

// Tabs
document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    $(`${tab.dataset.tab}Tab`).classList.add("active");
    updateStatsVisibility(tab.dataset.tab);
  };
});

// Clipboard
const copyToClipboard = async (text, btnId) => {
  const btn = $(btnId);
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = orig), 2000);
  } catch (err) {
    state.activeTabId !== null &&
      addLogToTab(state.activeTabId, SHARED.LOG_LEVEL.ERROR, "Copy failed", {
        name: "Dashboard",
      });
  }
};

DOM.thinking.copyBtn.onclick = () => {
  if (state.activeTabId === null) return;
  const instance = getTabInstance(state.activeTabId);
  instance.xhrData.thinkingText
    ? copyToClipboard(instance.xhrData.thinkingText, "copyThinking")
    : addLogToTab(
        state.activeTabId,
        SHARED.LOG_LEVEL.WARN,
        "No thinking content",
        { name: "Dashboard" }
      );
};

DOM.streaming.copyBtn.onclick = () => {
  if (state.activeTabId === null) return;
  const instance = getTabInstance(state.activeTabId);
  instance.xhrData.streamingText
    ? copyToClipboard(instance.xhrData.streamingText, "copyStreaming")
    : addLogToTab(
        state.activeTabId,
        SHARED.LOG_LEVEL.WARN,
        "No streaming content",
        { name: "Dashboard" }
      );
};

// New Tab
const openNewTab = () => {
  const { id, chip } = createPlaceholder();
  DOM.tabs.container.querySelector('span[style*="text-muted"]') &&
    (DOM.tabs.container.innerHTML = "");
  DOM.tabs.container.appendChild(chip);
  UTILS.msg
    .toBackground(SHARED.MSG.OPEN_AI_STUDIO, { model: SHARED.DEFAULTS.model })
    .then((res) => {
      if (!res?.success) {
        updatePlaceholder(id, SHARED.STATE.ERROR, "Failed to open");
        return setTimeout(() => removePlaceholder(id), 3000);
      }
      updatePlaceholder(id, SHARED.STATE.LOADING, "Loading page...");
      setTimeout(() => {
        removePlaceholder(id);
        addTab(res.tabId, SHARED.STATE.INITIALIZING);
        addLogToTab(res.tabId, SHARED.LOG_LEVEL.INFO, "AI Studio tab opened", {
          name: "Dashboard",
        });
      }, 100);
    });
};

// Theme Toggle
let holdTimer = null;
let isHolding = false;
const toggleTheme = () => {
  document.body.classList.toggle("light-theme");
  const isLight = document.body.classList.contains("light-theme");
  UTILS.storage.set("theme", isLight ? "light" : "dark");
  DOM.tabs.newBtn.style.transform = "scale(1.1)";
  setTimeout(() => (DOM.tabs.newBtn.style.transform = ""), 200);
  state.activeTabId !== null &&
    addLogToTab(
      state.activeTabId,
      SHARED.LOG_LEVEL.INFO,
      `Theme: ${isLight ? "light" : "dark"}`,
      { name: "Theme" }
    );
};

const handleHold = (action) => {
  const actions = {
    start: () => {
      isHolding = false;
      DOM.tabs.newBtn.classList.add("holding");
      holdTimer = setTimeout(() => {
        isHolding = true;
        toggleTheme();
      }, 2000);
    },
    end: () => {
      clearTimeout(holdTimer);
      DOM.tabs.newBtn.classList.remove("holding");
      !isHolding && openNewTab();
    },
    cancel: () => {
      clearTimeout(holdTimer);
      DOM.tabs.newBtn.classList.remove("holding");
    },
  };
  actions[action]();
};

DOM.tabs.newBtn.addEventListener("mousedown", () => handleHold("start"));
DOM.tabs.newBtn.addEventListener("mouseup", () => handleHold("end"));
DOM.tabs.newBtn.addEventListener("mouseleave", () => handleHold("cancel"));
DOM.tabs.newBtn.addEventListener(
  "touchstart",
  (e) => (e.preventDefault(), handleHold("start"))
);
DOM.tabs.newBtn.addEventListener(
  "touchend",
  (e) => (e.preventDefault(), handleHold("end"))
);

// Messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    const tabId = msg.tabId || sender.tab?.id;
    const handlers = {
      [SHARED.MSG.TAB_CREATED]: () =>
        !state.tabInstances.has(msg.tabId) &&
        addTab(msg.tabId, SHARED.STATE.INITIALIZING),
      [SHARED.MSG.TAB_LOADED]: () =>
        updateTabState(msg.tabId, SHARED.STATE.LOADING),
      [SHARED.MSG.TAB_ERROR]: () => (
        updateTabState(msg.tabId, SHARED.STATE.ERROR),
        addLogToTab(
          msg.tabId,
          SHARED.LOG_LEVEL.ERROR,
          msg.error || "Unknown error",
          { name: "TabManager" }
        )
      ),
      [SHARED.MSG.LOG]: () =>
        tabId &&
        addLogToTab(tabId, msg.level, msg.message, {
          name: msg.name,
          duration: msg.duration,
        }),
      [SHARED.MSG.AUDIO_STATUS]: () => {
        if (tabId) {
          getTabInstance(tabId).audio = msg.playing;
          updateTabsUI();
          saveTabInstances();
        }
      },
      [SHARED.MSG.CONTENT_READY]: () => {
        if (tabId) {
          state.tabInstances.has(tabId)
            ? updateTabState(tabId, SHARED.STATE.READY)
            : addTab(tabId, SHARED.STATE.READY);
          setTimeout(() => tryAutoStartAudio(tabId), 1000);
        }
      },
      [SHARED.MSG.TAB_REMOVED]: () => msg.tabId && removeTab(msg.tabId),
      [SHARED.MSG.XHR_EVENT]: () => {
        if (!tabId) return;
        const instance = getTabInstance(tabId);
        const data = msg.data;
        const xhrHandlers = {
          [SHARED.MSG.XHR_READY]: () =>
            addLogToTab(
              tabId,
              SHARED.LOG_LEVEL.SUCCESS,
              "XHR interceptor ready",
              { name: "XHR" }
            ),
          [SHARED.MSG.XHR_REQUEST]: () => {
            instance.xhrData = {
              ...createXHRData(),
              model: data.model || "unknown",
            };
            state.activeTabId === tabId && renderXHRData(instance.xhrData);
          },
          [SHARED.MSG.XHR_THINKING]: () => {
            if (data.total) {
              Object.assign(instance.xhrData, {
                thinkingChunks: data.count,
                thinkingChars: data.totalLength,
                thinkingText: data.total,
              });
              if (state.activeTabId === tabId) {
                renderXHRData(instance.xhrData);
                renderContent(tabId, "thinking", data.total, false);
              }
            }
          },
          [SHARED.MSG.XHR_STREAMING]: () => {
            if (data.total) {
              Object.assign(instance.xhrData, {
                streamingChunks: data.count,
                streamingChars: data.totalLength,
                streamingText: data.total,
              });
              if (state.activeTabId === tabId) {
                renderXHRData(instance.xhrData);
                renderContent(tabId, "streaming", data.total, false);
              }
            }
          },
          [SHARED.MSG.XHR_COMPLETE]: () => {
            instance.xhrData.duration = data.duration || 0;
            if (data.thinking)
              Object.assign(instance.xhrData, {
                thinkingChunks: data.thinkingCount,
                thinkingChars: data.thinking.length,
                thinkingText: data.thinking,
              });
            if (data.streaming)
              Object.assign(instance.xhrData, {
                streamingChunks: data.streamingCount,
                streamingChars: data.streaming.length,
                streamingText: data.streaming,
              });
            if (state.activeTabId === tabId) {
              renderXHRData(instance.xhrData);
              renderContent(
                tabId,
                "thinking",
                instance.xhrData.thinkingText,
                true
              );
              renderContent(
                tabId,
                "streaming",
                instance.xhrData.streamingText,
                true
              );
              const activeTabButton = document.querySelector(".tab.active");
              activeTabButton &&
                updateStatsVisibility(activeTabButton.dataset.tab);
            }
            saveTabInstances();
          },
        };
        xhrHandlers[data.type]?.();
      },
    };
    handlers[msg.type]?.();
  } catch (err) {
    console.error("Message error:", err);
  }
  sendResponse({ received: true });
  return true;
});

// Init
console.log("🚀 Dashboard initializing...");
restoreTabInstances();
startHealthMonitoring();
startAutoSave();

window.addEventListener("beforeunload", () => {
  saveTabInstances();
  stopHealthMonitoring();
  stopAutoSave();
});

renderActiveTab();

setInterval(
  () => UTILS.msg.toBackground(SHARED.MSG.KEEP_ALIVE),
  SHARED.TIMING.keepAliveInterval
);
setInterval(
  () => state.tabInstances.size > 0 && cleanupStaleData(),
  SHARED.TIMING.cleanupInterval
);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    console.log("👁️ Dashboard visible, checking tabs...");
    state.tabInstances.forEach((_, tabId) =>
      UTILS.tab
        .exists(tabId)
        .then(
          (exists) =>
            !exists &&
            (console.warn(`Tab ${tabId} no longer exists, removing...`),
            removeTab(tabId))
        )
    );
  }
});

window.cleanupStaleData = cleanupStaleData;
console.log("✅ Dashboard ready");
