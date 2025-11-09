const $ = (id) => document.getElementById(id);

// DOM
const logTableBody = $("logTableBody");
const thinkingBody = $("thinkingBody");
const streamingBody = $("streamingBody");
const xhrStats = $("xhrStats");
const connectedTabsContainer = $("connectedTabsContainer");
const settingsModal = $("settingsModal");
const editTabId = $("editTabId");
const promptInput = $("promptInput");
const promptLength = $("promptLength");
const modelSelect = $("modelSelect");
const temperatureInput = $("temperatureInput");
const budgetInput = $("budgetInput");
const topPInput = $("topPInput");
const autoAudioCheckbox = $("autoAudioCheckbox");

// STATE
const tabInstances = new Map();
const tabSequentialIds = new Map();
const contentCaches = new Map();
const tabHealth = new Map();
let activeTabId = null;
let editingTabId = null;
let nextSequentialId = 1;
let healthCheckInterval = null;
let autoSaveInterval = null;

// CONFIG
const STABILITY_CONFIG = {
  MAX_LOGS_PER_TAB: 500,
  AUTO_SAVE_INTERVAL: 10000,
  HEALTH_CHECK_INTERVAL: 15000,
  PING_TIMEOUT: 5000,
  MESSAGE_RETRY_COUNT: 3,
  MESSAGE_RETRY_DELAY: 1000,
};

const TAB_STATE = {
  INITIALIZING: "initializing",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

const DEFAULT_SETTINGS = {
  prompt: "this is prompt",
  model: "gemini-2.0-flash-thinking-exp",
  temperature: 1.5,
  thinkingBudget: 500,
  topP: 0.5,
  autoAudio: true, // Set to true to enable auto-audio by default
};

// PLACEHOLDER MANAGEMENT
let nextPlaceholderId = 1;
const placeholderChips = new Map();

const createPlaceholder = () => {
  const id = `placeholder-${nextPlaceholderId++}`;
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
      ${["settings", "run", "audio", "save", "clear"]
        .map(
          (action) =>
            `<button class="tab-chip-action ${action}" disabled title="${action}">
          ${
            action === "settings"
              ? "⚙️"
              : action === "run"
              ? "▶️"
              : action === "audio"
              ? "🔊"
              : action === "save"
              ? "💾"
              : "🗑️"
          }
        </button>`
        )
        .join("")}
      <span class="tab-chip-audio-indicator"></span>
      <button class="tab-chip-action close" disabled title="Close tab">×</button>
    </div>
  `;
  placeholderChips.set(id, chip);
  return { id, chip };
};

const updatePlaceholder = (id, state, text) => {
  const chip = placeholderChips.get(id);
  if (!chip) return;
  chip.className = `tab-chip ${state}`;
  const spinner =
    state === "loading" ? '<span class="tab-chip-spinner"></span>' : "";
  const icon = state === "loading" ? "🔄" : state === "error" ? "❌" : "⏳";
  const statusText =
    state === "loading"
      ? "loading..."
      : state === "error"
      ? "error"
      : "initializing...";
  chip.querySelector(".tab-chip-id").innerHTML = `${spinner}${icon} #...`;
  chip.querySelector(".tab-chip-prompt").textContent = text;
  chip.querySelector(".tab-chip-status").textContent = statusText;
};

const removePlaceholder = (id) => {
  const chip = placeholderChips.get(id);
  if (chip?.parentNode) chip.remove();
  placeholderChips.delete(id);
};

// SEQUENTIAL ID MANAGEMENT
const getSequentialId = (chromeTabId) => {
  if (!tabSequentialIds.has(chromeTabId)) {
    tabSequentialIds.set(chromeTabId, nextSequentialId++);
  }
  return tabSequentialIds.get(chromeTabId);
};

const removeSequentialId = (chromeTabId) => {
  tabSequentialIds.delete(chromeTabId);
};

// STORAGE
const saveTabInstances = () => {
  try {
    const data = {};
    const seqIds = {};
    tabInstances.forEach((instance, tabId) => {
      data[tabId] = {
        prompt: instance.prompt,
        model: instance.model,
        temperature: instance.temperature,
        thinkingBudget: instance.thinkingBudget,
        topP: instance.topP,
        autoAudio: instance.autoAudio,
        audio: instance.audio,
        state: instance.state,
        logs: instance.logs.slice(-STABILITY_CONFIG.MAX_LOGS_PER_TAB),
        xhrData: instance.xhrData,
      };
      seqIds[tabId] = tabSequentialIds.get(tabId);
    });
    localStorage.setItem("tabInstances", JSON.stringify(data));
    localStorage.setItem(
      "tabSequentialIds",
      JSON.stringify({ ids: seqIds, next: nextSequentialId })
    );
    console.log("✅ Auto-saved tab instances");
  } catch (err) {
    console.error("❌ Failed to save tab instances:", err);
  }
};

const restoreTabInstances = () => {
  try {
    const saved = localStorage.getItem("tabInstances");
    const savedSeqIds = localStorage.getItem("tabSequentialIds");
    if (!saved) return;

    const data = JSON.parse(saved);
    const tabIdsToRestore = Object.keys(data).map((id) => parseInt(id));

    if (tabIdsToRestore.length === 0) {
      console.log("📦 No tabs to restore");
      return;
    }

    console.log(`📦 Attempting to restore ${tabIdsToRestore.length} tabs...`);

    const validationPromises = tabIdsToRestore.map((tabId) => {
      return new Promise((resolve) => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            resolve({ tabId, exists: false });
          } else {
            resolve({ tabId, exists: true, tab });
          }
        });
      });
    });

    Promise.all(validationPromises).then((results) => {
      const validTabs = results.filter((r) => r.exists);
      const invalidTabs = results.filter((r) => !r.exists);

      // Restore sequential IDs only for valid tabs
      if (savedSeqIds) {
        const seqData = JSON.parse(savedSeqIds);
        const validSeqIds = {};

        validTabs.forEach(({ tabId }) => {
          if (seqData.ids && seqData.ids[tabId]) {
            validSeqIds[tabId] = seqData.ids[tabId];
            tabSequentialIds.set(tabId, seqData.ids[tabId]);
          }
        });

        const maxSeqId = Math.max(0, ...Object.values(validSeqIds));
        nextSequentialId = maxSeqId + 1;
        console.log(`🔢 Sequential ID counter: ${nextSequentialId}`);
      }

      // Restore valid tabs
      let restoredCount = 0;
      validTabs.forEach(({ tabId }) => {
        const savedInstance = data[tabId];
        const instance = {
          prompt: savedInstance.prompt || DEFAULT_SETTINGS.prompt,
          model: savedInstance.model || DEFAULT_SETTINGS.model,
          temperature:
            savedInstance.temperature || DEFAULT_SETTINGS.temperature,
          thinkingBudget:
            savedInstance.thinkingBudget || DEFAULT_SETTINGS.thinkingBudget,
          topP: savedInstance.topP || DEFAULT_SETTINGS.topP,
          autoAudio:
            savedInstance.autoAudio !== undefined
              ? savedInstance.autoAudio
              : DEFAULT_SETTINGS.autoAudio,
          audio: savedInstance.audio || false,
          state: savedInstance.state || TAB_STATE.READY,
          logs: savedInstance.logs || [],
          xhrData: savedInstance.xhrData || {
            thinkingChunks: 0,
            thinkingChars: 0,
            thinkingText: "",
            streamingChunks: 0,
            streamingChars: 0,
            streamingText: "",
            duration: 0,
            model: "-",
          },
        };

        tabInstances.set(tabId, instance);
        contentCaches.set(tabId, {
          thinking: { container: null, pre: null, cursor: null },
          streaming: { container: null, pre: null, cursor: null },
        });
        tabHealth.set(tabId, { lastPing: Date.now(), status: "healthy" });

        restoredCount++;

        if (activeTabId === null) {
          activeTabId = tabId;
        }
      });

      if (restoredCount > 0) {
        console.log(`✅ Restored ${restoredCount} tab(s)`);
      }
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
    localStorage.removeItem("tabInstances");
    localStorage.removeItem("tabSequentialIds");
  }
};

const cleanupStaleData = () => {
  console.log("🧹 Checking for stale tabs...");
  const currentTabIds = Array.from(tabInstances.keys());

  if (currentTabIds.length === 0) {
    console.log("✅ No tabs to check");
    return;
  }

  const validationPromises = currentTabIds.map((tabId) => {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        resolve({ tabId, exists: !chrome.runtime.lastError && !!tab });
      });
    });
  });

  Promise.all(validationPromises).then((results) => {
    const staleTabs = results.filter((r) => !r.exists);

    if (staleTabs.length === 0) {
      console.log("✅ No stale tabs found");
      return;
    }

    staleTabs.forEach(({ tabId }) => {
      console.warn(`🗑️ Removing stale tab ${tabId}`);
      removeTab(tabId);
    });

    console.log(`🧹 Cleaned up ${staleTabs.length} stale tab(s)`);
    saveTabInstances();
  });
};

window.cleanupStaleData = cleanupStaleData;

// MESSAGING
const sendMessageToTab = (tabId, message, callback, retryCount = 0) => {
  if (!tabId) return;
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError) {
      console.warn(`Tab ${tabId} not found`);
      updateTabHealth(tabId, "dead");
      removeTab(tabId);
      return;
    }
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        if (retryCount < STABILITY_CONFIG.MESSAGE_RETRY_COUNT) {
          setTimeout(() => {
            sendMessageToTab(tabId, message, callback, retryCount + 1);
          }, STABILITY_CONFIG.MESSAGE_RETRY_DELAY * (retryCount + 1));
        } else {
          updateTabHealth(tabId, "degraded");
        }
      } else {
        updateTabHealth(tabId, "healthy");
        if (callback) callback(response);
      }
    });
  });
};

// HEALTH MONITORING
const updateTabHealth = (tabId, status) => {
  tabHealth.set(tabId, { lastPing: Date.now(), status });
  updateTabsUI();
};

const pingTab = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== TAB_STATE.READY) return;
  const startTime = Date.now();
  const timeoutId = setTimeout(
    () => updateTabHealth(tabId, "dead"),
    STABILITY_CONFIG.PING_TIMEOUT
  );
  sendMessageToTab(tabId, { action: "ping" }, (response) => {
    clearTimeout(timeoutId);
    if (response?.pong) {
      const latency = Date.now() - startTime;
      updateTabHealth(tabId, latency > 2000 ? "degraded" : "healthy");
    } else {
      updateTabHealth(tabId, "degraded");
    }
  });
};

const startHealthMonitoring = () => {
  if (healthCheckInterval) return;
  healthCheckInterval = setInterval(() => {
    tabInstances.forEach((_, tabId) => pingTab(tabId));
  }, STABILITY_CONFIG.HEALTH_CHECK_INTERVAL);
  console.log("🏥 Health monitoring started");
};

const stopHealthMonitoring = () => {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log("🏥 Health monitoring stopped");
  }
};

const startAutoSave = () => {
  if (autoSaveInterval) return;
  autoSaveInterval = setInterval(
    () => saveTabInstances(),
    STABILITY_CONFIG.AUTO_SAVE_INTERVAL
  );
  console.log("💾 Auto-save started");
};

const stopAutoSave = () => {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
    console.log("💾 Auto-save stopped");
  }
};

// TAB INSTANCE MANAGEMENT
const createTabInstance = (tabId, state = TAB_STATE.INITIALIZING) => {
  const instance = {
    prompt: DEFAULT_SETTINGS.prompt,
    model: DEFAULT_SETTINGS.model,
    temperature: DEFAULT_SETTINGS.temperature,
    thinkingBudget: DEFAULT_SETTINGS.thinkingBudget,
    topP: DEFAULT_SETTINGS.topP,
    autoAudio: DEFAULT_SETTINGS.autoAudio,
    audio: false,
    state: state,
    logs: [],
    xhrData: {
      thinkingChunks: 0,
      thinkingChars: 0,
      thinkingText: "",
      streamingChunks: 0,
      streamingChars: 0,
      streamingText: "",
      duration: 0,
      model: "-",
    },
  };
  tabInstances.set(tabId, instance);
  contentCaches.set(tabId, {
    thinking: { container: null, pre: null, cursor: null },
    streaming: { container: null, pre: null, cursor: null },
  });
  tabHealth.set(tabId, { lastPing: Date.now(), status: "initializing" });
  getSequentialId(tabId);
  saveTabInstances();
  return instance;
};

const getTabInstance = (tabId) => {
  if (!tabInstances.has(tabId)) {
    return createTabInstance(tabId);
  }
  return tabInstances.get(tabId);
};

const addTab = (tabId, state = TAB_STATE.INITIALIZING) => {
  if (!tabInstances.has(tabId)) {
    createTabInstance(tabId, state);
    if (activeTabId === null) {
      activeTabId = tabId;
      renderActiveTab();
    }
    updateTabsUI();
    const seqId = getSequentialId(tabId);
    addLogToTab(tabId, "info", `Tab #${seqId} ${state}`, {
      name: "TabManager",
    });
  }
};

const updateTabState = (tabId, state) => {
  const instance = getTabInstance(tabId);
  instance.state = state;
  const seqId = getSequentialId(tabId);
  const stateEmoji = {
    [TAB_STATE.INITIALIZING]: "⏳",
    [TAB_STATE.LOADING]: "🔄",
    [TAB_STATE.READY]: "✅",
    [TAB_STATE.ERROR]: "❌",
  };
  addLogToTab(
    tabId,
    state === TAB_STATE.ERROR ? "error" : "success",
    `${stateEmoji[state]} ${state}`,
    { name: "TabManager" }
  );
  updateTabsUI();
  saveTabInstances();
};

const removeTab = (tabId) => {
  if (tabInstances.has(tabId)) {
    tabInstances.delete(tabId);
    contentCaches.delete(tabId);
    tabHealth.delete(tabId);
    removeSequentialId(tabId);
    if (activeTabId === tabId) {
      const remainingTabs = Array.from(tabInstances.keys());
      activeTabId = remainingTabs.length > 0 ? remainingTabs[0] : null;
      renderActiveTab();
    }
    updateTabsUI();
    saveTabInstances();
  }
};

const setActiveTab = (tabId) => {
  if (tabInstances.has(tabId)) {
    activeTabId = tabId;
    renderActiveTab();
    updateTabsUI();
  }
};

// SETTINGS MODAL
const openSettings = (tabId) => {
  const instance = getTabInstance(tabId);
  const seqId = getSequentialId(tabId);
  editingTabId = tabId;
  editTabId.textContent = seqId;
  promptInput.value = instance.prompt;
  promptLength.textContent = `${instance.prompt.length} chars`;
  modelSelect.value = instance.model;
  temperatureInput.value = instance.temperature;
  budgetInput.value = instance.thinkingBudget;
  topPInput.value = instance.topP;
  autoAudioCheckbox.checked = instance.autoAudio;
  settingsModal.classList.add("active");
};

const closeSettings = () => {
  editingTabId = null;
  settingsModal.classList.remove("active");
};

const saveSettings = () => {
  if (editingTabId === null) return;
  const instance = getTabInstance(editingTabId);
  instance.prompt = promptInput.value;
  instance.model = modelSelect.value;
  instance.temperature = parseFloat(temperatureInput.value);
  instance.thinkingBudget = parseInt(budgetInput.value);
  instance.topP = parseFloat(topPInput.value);
  instance.autoAudio = autoAudioCheckbox.checked;
  addLogToTab(editingTabId, "success", `Settings updated`, {
    name: "Settings",
  });
  updateTabsUI();
  saveTabInstances();
  const btn = $("saveSettingsBtn");
  btn.textContent = "✅ Saved!";
  setTimeout(() => {
    btn.textContent = "💾 Save Settings";
    closeSettings();
  }, 1000);
};

const resetSettings = () => {
  if (!confirm("Reset this tab to default settings?")) return;
  if (editingTabId === null) return;
  promptInput.value = DEFAULT_SETTINGS.prompt;
  modelSelect.value = DEFAULT_SETTINGS.model;
  temperatureInput.value = DEFAULT_SETTINGS.temperature;
  budgetInput.value = DEFAULT_SETTINGS.thinkingBudget;
  topPInput.value = DEFAULT_SETTINGS.topP;
  autoAudioCheckbox.checked = DEFAULT_SETTINGS.autoAudio;
  promptLength.textContent = `${DEFAULT_SETTINGS.prompt.length} chars`;
};

// QUICK ACTIONS
const runTabAutomation = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== TAB_STATE.READY) {
    addLogToTab(tabId, "warn", `Cannot run: tab is ${instance.state}`, {
      name: "QuickRun",
    });
    return;
  }
  const settings = {
    prompt: instance.prompt,
    model: instance.model,
    temperature: instance.temperature,
    thinkingBudget: instance.thinkingBudget,
    topP: instance.topP,
  };
  addLogToTab(
    tabId,
    "info",
    `Running: "${instance.prompt.substring(0, 50)}${
      instance.prompt.length > 50 ? "..." : ""
    }"`,
    { name: "QuickRun" }
  );
  sendMessageToTab(tabId, { action: "runAutomation", settings });
};

const toggleTabAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (instance.state !== TAB_STATE.READY) {
    addLogToTab(
      tabId,
      "warn",
      `Cannot toggle audio: tab is ${instance.state}`,
      { name: "QuickAudio" }
    );
    return;
  }
  const action = instance.audio ? "stopAudio" : "startAudio";
  sendMessageToTab(tabId, { action }, (response) => {
    if (response?.success) {
      instance.audio = !instance.audio;
      updateTabsUI();
      saveTabInstances();
      addLogToTab(
        tabId,
        "info",
        `Audio ${instance.audio ? "started" : "stopped"}`,
        { name: "QuickAudio" }
      );
    }
  });
};

const saveTabLogs = (tabId) => {
  const instance = getTabInstance(tabId);
  const seqId = getSequentialId(tabId);
  if (instance.logs.length === 0) {
    addLogToTab(tabId, "warn", "No logs to save", { name: "QuickSave" });
    return;
  }
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
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `logs-tab${seqId}-${Date.now()}.txt`;
  a.click();
  addLogToTab(tabId, "success", `Saved ${instance.logs.length} logs`, {
    name: "QuickSave",
  });
};

const clearTabData = (tabId) => {
  const seqId = getSequentialId(tabId);
  if (!confirm(`Clear all data for Tab #${seqId}? This cannot be undone.`))
    return;
  const instance = getTabInstance(tabId);
  instance.logs = [];
  instance.xhrData = {
    thinkingChunks: 0,
    thinkingChars: 0,
    thinkingText: "",
    streamingChunks: 0,
    streamingChars: 0,
    streamingText: "",
    duration: 0,
    model: "-",
  };
  const cache = contentCaches.get(tabId);
  if (cache) {
    cache.thinking = { container: null, pre: null, cursor: null };
    cache.streaming = { container: null, pre: null, cursor: null };
  }
  if (activeTabId === tabId) {
    renderActiveTab();
  }
  saveTabInstances();
  addLogToTab(tabId, "info", "Data cleared", { name: "Dashboard" });
  updateTabsUI();
};

// UI RENDERING
const getHealthIcon = (tabId) => {
  const health = tabHealth.get(tabId);
  if (!health) return "⚪";
  const instance = getTabInstance(tabId);
  if (instance.state === TAB_STATE.INITIALIZING) return "⏳";
  if (instance.state === TAB_STATE.LOADING) return "🔄";
  if (instance.state === TAB_STATE.ERROR) return "❌";
  switch (health.status) {
    case "healthy":
      return "🟢";
    case "degraded":
      return "🟡";
    case "dead":
      return "🔴";
    default:
      return "⚪";
  }
};

const getStateLabel = (state) => {
  switch (state) {
    case TAB_STATE.INITIALIZING:
      return "initializing...";
    case TAB_STATE.LOADING:
      return "loading...";
    case TAB_STATE.READY:
      return "";
    case TAB_STATE.ERROR:
      return "error";
    default:
      return "";
  }
};

const updateTabsUI = () => {
  if (tabInstances.size === 0) {
    connectedTabsContainer.innerHTML =
      '<span style="color: var(--text-muted); font-size: 0.75rem;">No tabs connected</span>';
    return;
  }
  connectedTabsContainer.innerHTML = "";
  const sortedTabs = Array.from(tabInstances.keys()).sort(
    (a, b) => getSequentialId(a) - getSequentialId(b)
  );

  sortedTabs.forEach((tabId) => {
    const instance = tabInstances.get(tabId);
    const seqId = getSequentialId(tabId);
    const chip = document.createElement("div");
    const stateClass =
      instance.state === TAB_STATE.READY ? "ready" : instance.state;
    chip.className = `tab-chip ${stateClass} ${
      activeTabId === tabId ? "active" : ""
    }`;
    const promptPreview =
      instance.prompt.length > 20
        ? instance.prompt.substring(0, 20) + "..."
        : instance.prompt;
    const healthIcon = getHealthIcon(tabId);
    const stateLabel = getStateLabel(instance.state);
    const spinner =
      instance.state === TAB_STATE.LOADING
        ? '<span class="tab-chip-spinner"></span>'
        : "";

    chip.innerHTML = `
      <div class="tab-chip-main">
        <span class="tab-chip-id">${spinner}${healthIcon} #${seqId}</span>
        <span class="tab-chip-prompt">${promptPreview}</span>
        ${
          stateLabel ? `<span class="tab-chip-status">${stateLabel}</span>` : ""
        }
      </div>
      <div class="tab-chip-actions">
        <button class="tab-chip-action settings" data-tab-id="${tabId}" title="Settings" ${
      instance.state !== TAB_STATE.READY ? "disabled" : ""
    }>⚙️</button>
        <button class="tab-chip-action run" data-tab-id="${tabId}" title="Run automation" ${
      instance.state !== TAB_STATE.READY ? "disabled" : ""
    }>▶️</button>
        <button class="tab-chip-action audio" data-tab-id="${tabId}" title="Toggle audio" ${
      instance.state !== TAB_STATE.READY ? "disabled" : ""
    }>${instance.audio ? "🔇" : "🔊"}</button>
        <button class="tab-chip-action save" data-tab-id="${tabId}" title="Save logs">💾</button>
        <button class="tab-chip-action clear" data-tab-id="${tabId}" title="Clear data">🗑️</button>
        <span class="tab-chip-audio-indicator ${
          instance.audio ? "on" : ""
        }"></span>
        <button class="tab-chip-action close" data-tab-id="${tabId}" title="Close tab">×</button>
      </div>
      ${
        instance.logs.length > 0
          ? `<span class="tab-chip-badge">${instance.logs.length}</span>`
          : ""
      }
    `;

    chip.onclick = (e) => {
      if (e.target.tagName === "BUTTON" || e.target.tagName === "SPAN") return;
      setActiveTab(tabId);
    };
    chip.querySelector(".settings").onclick = (e) => {
      e.stopPropagation();
      if (instance.state === TAB_STATE.READY) openSettings(tabId);
    };
    chip.querySelector(".run").onclick = (e) => {
      e.stopPropagation();
      if (instance.state === TAB_STATE.READY) runTabAutomation(tabId);
    };
    chip.querySelector(".audio").onclick = (e) => {
      e.stopPropagation();
      if (instance.state === TAB_STATE.READY) toggleTabAudio(tabId);
    };
    chip.querySelector(".save").onclick = (e) => {
      e.stopPropagation();
      saveTabLogs(tabId);
    };
    chip.querySelector(".clear").onclick = (e) => {
      e.stopPropagation();
      clearTabData(tabId);
    };
    chip.querySelector(".close").onclick = (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            `Tab ${tabId} not found, cleaning up:`,
            chrome.runtime.lastError.message
          );
          removeTab(tabId);
        }
      });
    };
    connectedTabsContainer.appendChild(chip);
  });
};

const renderActiveTab = () => {
  if (activeTabId === null) {
    renderEmptyState();
    return;
  }
  const instance = getTabInstance(activeTabId);
  renderLogs(instance.logs);
  renderXHRData(instance.xhrData);
  renderContent(activeTabId, "thinking", instance.xhrData.thinkingText, false);
  renderContent(
    activeTabId,
    "streaming",
    instance.xhrData.streamingText,
    false
  );
};

const renderEmptyState = () => {
  logTableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No tab selected</div></div></td></tr>`;
  thinkingBody.innerHTML =
    '<div class="empty-state"><div class="empty-icon">🤔</div><div class="empty-text">No tab selected</div></div>';
  streamingBody.innerHTML =
    '<div class="empty-state"><div class="empty-icon">✨</div><div class="empty-text">No tab selected</div></div>';
  $("logsBadge").textContent = "0";
  $("thinkingBadge").textContent = "0";
  $("streamingBadge").textContent = "0";
};

const renderLogs = (logs) => {
  if (logs.length === 0) {
    logTableBody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No logs yet</div></div></td></tr>`;
    $("logsBadge").textContent = "0";
    return;
  }
  logTableBody.innerHTML = "";
  logs.forEach((log) => {
    const row = document.createElement("tr");
    row.className = `log-row ${log.level}`;
    row.innerHTML = `<td class="log-time">${log.time}</td><td class="log-fn">${log.function}</td><td class="log-dur">${log.duration}</td><td class="log-msg">${log.message}</td>`;
    logTableBody.appendChild(row);
  });
  $("logsBadge").textContent = logs.length;
  const container = logTableBody.closest(".log-container");
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
};

const renderXHRData = (xhrData) => {
  $("thinkingBadge").textContent = xhrData.thinkingChunks;
  $("streamingBadge").textContent = xhrData.streamingChunks;

  // Update stats if they exist (might not exist if wrong tab is active)
  const activeThinkingChunks = $("thinkingChunks");
  const activeThinkingChars = $("thinkingChars");
  const activeStreamingChunks = $("streamingChunks");
  const activeStreamingChars = $("streamingChars");
  const activeDurationMs = $("durationMs");
  const activeRequestModel = $("requestModel");

  if (activeThinkingChunks)
    activeThinkingChunks.textContent = xhrData.thinkingChunks;
  if (activeThinkingChars)
    activeThinkingChars.textContent = xhrData.thinkingChars.toLocaleString();
  if (activeStreamingChunks)
    activeStreamingChunks.textContent = xhrData.streamingChunks;
  if (activeStreamingChars)
    activeStreamingChars.textContent = xhrData.streamingChars.toLocaleString();
  if (activeDurationMs) activeDurationMs.textContent = xhrData.duration + "ms";
  if (activeRequestModel) activeRequestModel.textContent = xhrData.model;

  // Log for debugging
  console.log(
    `📊 XHR Data Updated: Duration=${xhrData.duration}ms, Thinking=${xhrData.thinkingChunks}, Streaming=${xhrData.streamingChunks}`
  );
};

const renderContent = (tabId, type, text, isComplete = false) => {
  const bodyContainer = type === "thinking" ? thinkingBody : streamingBody;
  const cache = contentCaches.get(tabId)?.[type];
  if (!cache) return;
  if (!text) {
    bodyContainer.innerHTML = `<div class="empty-state"><div class="empty-icon">${
      type === "thinking" ? "🤔" : "✨"
    }</div><div class="empty-text">No ${type} data yet</div></div>`;
    cache.container = null;
    cache.pre = null;
    cache.cursor = null;
    return;
  }
  const scrollThreshold = 150;
  const isAtBottom =
    bodyContainer.scrollHeight -
      bodyContainer.scrollTop -
      bodyContainer.clientHeight <=
    scrollThreshold;
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
  if (!isComplete) {
    if (!cache.cursor.parentNode) cache.container.appendChild(cache.cursor);
  } else {
    if (cache.cursor.parentNode) cache.cursor.remove();
  }
  if (isAtBottom) {
    requestAnimationFrame(
      () => (bodyContainer.scrollTop = bodyContainer.scrollHeight)
    );
  }
};

// LOGGING
const addLogToTab = (tabId, level, msg, meta = {}) => {
  const instance = getTabInstance(tabId);
  const time = new Date().toLocaleTimeString();
  const fn = meta.name || "-";
  const dur = meta.duration ? `${meta.duration.toFixed(1)}ms` : "-";
  instance.logs.push({
    time,
    level,
    function: fn,
    duration: dur,
    message: msg,
  });
  if (instance.logs.length > STABILITY_CONFIG.MAX_LOGS_PER_TAB) {
    instance.logs = instance.logs.slice(-STABILITY_CONFIG.MAX_LOGS_PER_TAB);
  }
  if (activeTabId === tabId) {
    renderLogs(instance.logs);
  } else {
    updateTabsUI();
  }
};

// AUDIO - FIXED WITH RETRY MECHANISM
const tryAutoStartAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance.autoAudio) {
    console.log(`Tab ${tabId}: Auto-audio disabled in settings`);
    return;
  }

  if (instance.audio) {
    console.log(`Tab ${tabId}: Audio already playing`);
    return;
  }

  if (instance.state !== TAB_STATE.READY) {
    console.log(`Tab ${tabId}: Not ready yet (state: ${instance.state})`);
    return;
  }

  addLogToTab(tabId, "info", `Auto-starting audio...`, { name: "Audio" });

  // Try multiple times with increasing delays to ensure content script is ready
  let attempts = 0;
  const maxAttempts = 3;

  const attemptStart = () => {
    attempts++;
    console.log(`Tab ${tabId}: Audio start attempt ${attempts}/${maxAttempts}`);

    sendMessageToTab(tabId, { action: "startAudio" }, (response) => {
      if (response?.success) {
        instance.audio = true;
        updateTabsUI();
        saveTabInstances();
        addLogToTab(tabId, "success", `Audio started (attempt ${attempts})`, {
          name: "Audio",
        });
        console.log(`Tab ${tabId}: Audio started successfully`);
      } else if (response?.alreadyActive) {
        instance.audio = true;
        updateTabsUI();
        saveTabInstances();
        addLogToTab(tabId, "info", `Audio already active`, { name: "Audio" });
      } else if (attempts < maxAttempts) {
        console.log(`Tab ${tabId}: Audio start failed, retrying...`);
        setTimeout(attemptStart, 1000 * attempts);
      } else {
        addLogToTab(
          tabId,
          "warn",
          `Audio auto-start failed after ${maxAttempts} attempts`,
          { name: "Audio" }
        );
        console.warn(
          `Tab ${tabId}: Audio auto-start failed after ${maxAttempts} attempts`
        );
      }
    });
  };

  // Start first attempt after a delay to ensure content script is fully loaded
  setTimeout(attemptStart, 1500);
};

// MODAL HANDLERS
$("closeSettings").onclick = closeSettings;
settingsModal.onclick = (e) => e.target === settingsModal && closeSettings();
document.onkeydown = (e) => {
  if (e.key === "Escape") closeSettings();
};
promptInput.oninput = () =>
  (promptLength.textContent = `${promptInput.value.length} chars`);
$("saveSettingsBtn").onclick = saveSettings;
$("resetSettingsBtn").onclick = resetSettings;

// THEME
const savedTheme = localStorage.getItem("theme") || "dark";
if (savedTheme === "light") {
  document.body.classList.add("light-theme");
}

// TABS
const updateStatsVisibility = (activeTab) => {
  if (activeTabId === null) {
    xhrStats.classList.remove("active");
    return;
  }
  const instance = getTabInstance(activeTabId);
  xhrStats.classList.remove("active");
  xhrStats.innerHTML = "";
  if (activeTab === "thinking") {
    xhrStats.classList.add("active");
    xhrStats.innerHTML = `
      <div class="stat"><span class="stat-label">Chunks</span><span class="stat-value" id="thinkingChunks">${
        instance.xhrData.thinkingChunks
      }</span></div>
      <div class="stat"><span class="stat-label">Characters</span><span class="stat-value" id="thinkingChars">${instance.xhrData.thinkingChars.toLocaleString()}</span></div>
      <div class="stat"><span class="stat-label">Model</span><span class="stat-value" id="requestModel">${
        instance.xhrData.model
      }</span></div>
    `;
  } else if (activeTab === "streaming") {
    xhrStats.classList.add("active");
    xhrStats.innerHTML = `
      <div class="stat"><span class="stat-label">Chunks</span><span class="stat-value" id="streamingChunks">${
        instance.xhrData.streamingChunks
      }</span></div>
      <div class="stat"><span class="stat-label">Characters</span><span class="stat-value" id="streamingChars">${instance.xhrData.streamingChars.toLocaleString()}</span></div>
      <div class="stat"><span class="stat-label">Duration</span><span class="stat-value" id="durationMs">${
        instance.xhrData.duration
      }ms</span></div>
      <div class="stat"><span class="stat-label">Model</span><span class="stat-value" id="requestModel">${
        instance.xhrData.model
      }</span></div>
    `;
  }
};

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

// CLIPBOARD
const copyToClipboard = async (text, btnId) => {
  const btn = $(btnId);
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = orig), 2000);
  } catch (err) {
    if (activeTabId !== null) {
      addLogToTab(activeTabId, "error", `Copy failed`, { name: "Dashboard" });
    }
  }
};

$("copyThinking").onclick = () => {
  if (activeTabId === null) return;
  const instance = getTabInstance(activeTabId);
  instance.xhrData.thinkingText
    ? copyToClipboard(instance.xhrData.thinkingText, "copyThinking")
    : addLogToTab(activeTabId, "warn", "No thinking content", {
        name: "Dashboard",
      });
};

$("copyStreaming").onclick = () => {
  if (activeTabId === null) return;
  const instance = getTabInstance(activeTabId);
  instance.xhrData.streamingText
    ? copyToClipboard(instance.xhrData.streamingText, "copyStreaming")
    : addLogToTab(activeTabId, "warn", "No streaming content", {
        name: "Dashboard",
      });
};

// NEW TAB CREATION
const openNewTab = () => {
  const { id, chip } = createPlaceholder();
  if (connectedTabsContainer.querySelector('span[style*="text-muted"]')) {
    connectedTabsContainer.innerHTML = "";
  }
  connectedTabsContainer.appendChild(chip);
  chrome.runtime.sendMessage(
    { type: "OPEN_AI_STUDIO", model: DEFAULT_SETTINGS.model },
    (res) => {
      if (chrome.runtime.lastError || !res?.success) {
        updatePlaceholder(id, "error", "Failed to open");
        setTimeout(() => removePlaceholder(id), 3000);
        return;
      }
      updatePlaceholder(id, "loading", "Loading page...");
      setTimeout(() => {
        removePlaceholder(id);
        addTab(res.tabId, TAB_STATE.INITIALIZING);
        addLogToTab(res.tabId, "info", `AI Studio tab opened`, {
          name: "Dashboard",
        });
      }, 100);
    }
  );
};

// NEW TAB BUTTON WITH HOLD-TO-TOGGLE-THEME
let holdTimer = null;
let isHolding = false;

const toggleTheme = () => {
  document.body.classList.toggle("light-theme");
  const isLight = document.body.classList.contains("light-theme");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  $("newTabBtn").style.transform = "scale(1.1)";
  setTimeout(() => ($("newTabBtn").style.transform = ""), 200);
  if (activeTabId !== null) {
    addLogToTab(activeTabId, "info", `Theme: ${isLight ? "light" : "dark"}`, {
      name: "Theme",
    });
  }
};

const startHold = () => {
  isHolding = false;
  $("newTabBtn").classList.add("holding");
  holdTimer = setTimeout(() => {
    isHolding = true;
    toggleTheme();
  }, 2000);
};

const endHold = () => {
  clearTimeout(holdTimer);
  $("newTabBtn").classList.remove("holding");
  if (!isHolding) openNewTab();
};

const cancelHold = () => {
  clearTimeout(holdTimer);
  $("newTabBtn").classList.remove("holding");
};

$("newTabBtn").addEventListener("mousedown", startHold);
$("newTabBtn").addEventListener("mouseup", endHold);
$("newTabBtn").addEventListener("mouseleave", cancelHold);
$("newTabBtn").addEventListener("touchstart", (e) => {
  e.preventDefault();
  startHold();
});
$("newTabBtn").addEventListener("touchend", (e) => {
  e.preventDefault();
  endHold();
});

// MESSAGES - UPDATED WITH DURATION FIX
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    const tabId = msg.tabId || sender.tab?.id;

    if (msg.type === "TAB_CREATED") {
      if (!tabInstances.has(msg.tabId)) {
        addTab(msg.tabId, TAB_STATE.INITIALIZING);
      }
    }

    if (msg.type === "TAB_LOADED") {
      updateTabState(msg.tabId, TAB_STATE.LOADING);
    }

    if (msg.type === "TAB_ERROR") {
      updateTabState(msg.tabId, TAB_STATE.ERROR);
      addLogToTab(msg.tabId, "error", msg.error || "Unknown error", {
        name: "TabManager",
      });
    }

    if (msg.type === "LOG") {
      if (tabId) {
        addLogToTab(tabId, msg.level, msg.message, {
          name: msg.name,
          duration: msg.duration,
        });
      }
    }

    if (msg.type === "AUDIO_STATUS" && tabId) {
      const instance = getTabInstance(tabId);
      instance.audio = msg.playing;
      updateTabsUI();
      saveTabInstances();
    }

    if (msg.type === "CONTENT_READY" && tabId) {
      const existed = tabInstances.has(tabId);
      if (!existed) {
        addTab(tabId, TAB_STATE.READY);
      } else {
        updateTabState(tabId, TAB_STATE.READY);
      }
      setTimeout(() => tryAutoStartAudio(tabId), 1000);
    }

    if (msg.type === "TAB_REMOVED" && msg.tabId) {
      removeTab(msg.tabId);
    }

    if (msg.type === "XHR_EVENT" && tabId) {
      const instance = getTabInstance(tabId);
      const data = msg.data;

      if (data.type === "interceptor-ready") {
        addLogToTab(tabId, "success", "XHR interceptor ready", { name: "XHR" });
      }

      if (data.type === "request") {
        instance.xhrData = {
          thinkingChunks: 0,
          thinkingChars: 0,
          thinkingText: "",
          streamingChunks: 0,
          streamingChars: 0,
          streamingText: "",
          duration: 0,
          model: data.model || "unknown",
        };
        if (activeTabId === tabId) {
          renderXHRData(instance.xhrData);
        }
      }

      if (data.type === "thinking-update" && data.total) {
        instance.xhrData.thinkingChunks = data.count;
        instance.xhrData.thinkingChars = data.totalLength;
        instance.xhrData.thinkingText = data.total;
        if (activeTabId === tabId) {
          renderXHRData(instance.xhrData);
          renderContent(tabId, "thinking", data.total, false);
        }
      }

      if (data.type === "streaming-update" && data.total) {
        instance.xhrData.streamingChunks = data.count;
        instance.xhrData.streamingChars = data.totalLength;
        instance.xhrData.streamingText = data.total;
        if (activeTabId === tabId) {
          renderXHRData(instance.xhrData);
          renderContent(tabId, "streaming", data.total, false);
        }
      }

      if (data.type === "complete") {
        // FIXED: Ensure duration is properly captured
        instance.xhrData.duration = data.duration || 0;

        if (data.thinking) {
          instance.xhrData.thinkingChunks = data.thinkingCount;
          instance.xhrData.thinkingChars = data.thinking.length;
          instance.xhrData.thinkingText = data.thinking;
        }
        if (data.streaming) {
          instance.xhrData.streamingChunks = data.streamingCount;
          instance.xhrData.streamingChars = data.streaming.length;
          instance.xhrData.streamingText = data.streaming;
        }

        if (activeTabId === tabId) {
          renderXHRData(instance.xhrData);
          renderContent(tabId, "thinking", instance.xhrData.thinkingText, true);
          renderContent(
            tabId,
            "streaming",
            instance.xhrData.streamingText,
            true
          );
        }

        // FIXED: Force update stats visibility to ensure duration shows
        const activeTabButton = document.querySelector(".tab.active");
        if (activeTabButton && activeTabId === tabId) {
          updateStatsVisibility(activeTabButton.dataset.tab);
        }

        saveTabInstances();
      }
    }
  } catch (err) {
    console.error("Message error:", err);
  }
  sendResponse({ received: true });
  return true;
});

// INIT
console.log("🚀 Dashboard initializing...");
restoreTabInstances();
startHealthMonitoring();
startAutoSave();

window.addEventListener("beforeunload", () => {
  saveTabInstances();
  stopHealthMonitoring();
  stopAutoSave();
});

renderEmptyState();

setInterval(
  () => chrome.runtime.sendMessage({ type: "KEEP_ALIVE" }).catch(() => {}),
  25000
);

// Periodic cleanup every 5 minutes
setInterval(() => {
  if (tabInstances.size > 0) {
    cleanupStaleData();
  }
}, 5 * 60 * 1000);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    console.log("👁️ Dashboard visible, checking tabs...");
    tabInstances.forEach((_, tabId) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          console.warn(`Tab ${tabId} no longer exists, removing...`);
          removeTab(tabId);
        }
      });
    });
  }
});

console.log("✅ Dashboard ready");
