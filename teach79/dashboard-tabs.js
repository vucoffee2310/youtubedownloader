// ✅ IDEMPOTENT: Safe to call multiple times
const addTab = (tabId, tabState = SHARED.STATE.LOADING) => {
  if (state.recentlyClosedTabs.has(tabId)) {
    console.log(`⛔ Ignoring recently closed tab ${tabId}`);
    return;
  }

  if (state.isRestoring && !state.userCreatedTabs.has(tabId)) {
    return setTimeout(() => addTab(tabId, tabState), 100);
  }

  // ✅ Idempotent: Only create if doesn't exist
  if (!state.tabInstances.has(tabId)) {
    const instance = getTabInstance(tabId);
    if (!instance) return;
    instance.state = tabState;
    renderUI();
    saveTabInstances();
    addLogToTab(
      tabId,
      SHARED.LOG_LEVEL.INFO,
      `Tab #${getSequentialId(tabId)} loading...`,
      { name: "TabManager" }
    );
  }
};

// ✅ IDEMPOTENT: Safe to call multiple times
const updateTabState = (tabId, tabState) => {
  if (state.isRestoring && !state.userCreatedTabs.has(tabId)) {
    return setTimeout(() => updateTabState(tabId, tabState), 100);
  }

  const instance = getTabInstance(tabId);
  if (!instance) return;

  // ✅ Idempotent: Only update if state actually changes
  if (instance.state === tabState) {
    console.log(`✓ Tab ${tabId} already in state ${tabState}`);
    return;
  }

  const oldState = instance.state;
  instance.state = tabState;
  const stateInfo = STATE_INFO[tabState];
  addLogToTab(
    tabId,
    tabState === SHARED.STATE.ERROR
      ? SHARED.LOG_LEVEL.ERROR
      : SHARED.LOG_LEVEL.SUCCESS,
    `${stateInfo?.icon || "📍"} ${oldState} → ${tabState}`,
    { name: "TabManager" }
  );
  renderUI();
  saveTabInstances();
};

const removeTab = (tabId) => {
  if (!state.tabInstances.has(tabId)) return;

  state.recentlyClosedTabs.add(tabId);
  setTimeout(() => state.recentlyClosedTabs.delete(tabId), 5000);

  clearTimeout(state._audioSaveTimeout);
  state.tabInstances.delete(tabId);
  state.contentCaches.delete(tabId);
  state.tabHealth.delete(tabId);
  state.tabSequentialIds.delete(tabId);
  state._audioStarting.delete(tabId);
  state.userCreatedTabs.delete(tabId);

  if (state.preferredActiveTabId === tabId) {
    state.preferredActiveTabId = null;
  }
  renderUI();
  saveTabInstances();
};

const setActiveTab = (tabId) => {
  if (setActiveTabId(tabId)) {
    renderUI();
    saveTabInstances();
  }
};

const openSettings = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance) return;
  state.editingTabId = tabId;
  DOM.settings.tabId.textContent = getSequentialId(tabId);
  const promptTextarea = DOM.settings.prompt;
  if (promptTextarea) {
    promptTextarea.value = instance.prompt || "";
    DOM.settings.promptLength.textContent = `${
      (instance.prompt || "").length
    } chars`;
    setTimeout(() => {
      promptTextarea.focus();
      promptTextarea.blur();
      promptTextarea.focus();
    }, 200);
  }
  DOM.settings.model.value = instance.model;
  DOM.settings.temperature.value = instance.temperature;
  DOM.settings.topP.value = instance.topP;
  DOM.settings.autoAudio.checked = instance.autoAudio;
  const usesLevel = SHARED.usesThinkingLevel(instance.model);
  document.getElementById("budgetGroup").style.display = usesLevel
    ? "none"
    : "block";
  document.getElementById("levelGroup").style.display = usesLevel
    ? "block"
    : "none";
  if (usesLevel) {
    document.getElementById("levelSelect").value =
      instance.thinkingLevel || "high";
  } else {
    DOM.settings.budget.value = instance.thinkingBudget;
  }
  DOM.settings.modal.classList.add("active");
};

const closeSettings = () => {
  state.editingTabId = null;
  DOM.settings.modal.classList.remove("active");
  DOM.settings.prompt?.blur();
};

const saveSettings = () => {
  if (state.editingTabId === null) return;
  const instance = getTabInstance(state.editingTabId);
  if (!instance) return;
  const selectedModel = DOM.settings.model.value;
  const usesLevel = SHARED.usesThinkingLevel(selectedModel);
  const settings = {
    prompt: DOM.settings.prompt.value,
    model: selectedModel,
    temperature: parseFloat(DOM.settings.temperature.value),
    topP: parseFloat(DOM.settings.topP.value),
    autoAudio: DOM.settings.autoAudio.checked,
  };
  if (usesLevel) {
    settings.thinkingLevel = document.getElementById("levelSelect").value;
  } else {
    settings.thinkingBudget = parseInt(DOM.settings.budget.value);
  }

  // ✅ Use centralized update
  updateTab(state.editingTabId, settings);

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
  document.getElementById("levelSelect").value = SHARED.DEFAULTS.thinkingLevel;
  DOM.settings.promptLength.textContent = `${SHARED.DEFAULTS.prompt.length} chars`;
  const usesLevel = SHARED.usesThinkingLevel(SHARED.DEFAULTS.model);
  document.getElementById("budgetGroup").style.display = usesLevel
    ? "none"
    : "block";
  document.getElementById("levelGroup").style.display = usesLevel
    ? "block"
    : "none";
};

const runTabAutomation = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance) return;
  if (instance.state !== SHARED.STATE.READY) {
    return addLogToTab(
      tabId,
      SHARED.LOG_LEVEL.WARN,
      `Cannot run: tab is ${instance.state}`,
      { name: "QuickRun" }
    );
  }
  const usesLevel = SHARED.usesThinkingLevel(instance.model);
  const settings = {
    prompt: instance.prompt,
    model: instance.model,
    temperature: instance.temperature,
    topP: instance.topP,
  };
  if (usesLevel) {
    settings.thinkingLevel = instance.thinkingLevel || "high";
  } else {
    settings.thinkingBudget = instance.thinkingBudget;
  }
  sendMessageToTab(tabId, { action: SHARED.MSG.ACTION_RUN, settings });
};

const toggleTabAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance || instance.state !== SHARED.STATE.READY) return;
  const action = instance.audio
    ? SHARED.MSG.ACTION_STOP_AUDIO
    : SHARED.MSG.ACTION_START_AUDIO;
  sendMessageToTab(tabId, { action });
};

const saveTabLogs = (tabId) => {
  const instance = getTabInstance(tabId);
  if (!instance || instance.logs.length === 0) return;
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
  if (!instance) return;
  instance.logs = [];
  instance.xhrData = createXHRData();
  const cache = state.contentCaches.get(tabId);
  if (cache) Object.assign(cache, createContentCache());
  const activeTabId = getActiveTabId();
  if (activeTabId === tabId) renderActiveTab();
  saveTabInstances();
  addLogToTab(tabId, SHARED.LOG_LEVEL.INFO, "Data cleared", {
    name: "Dashboard",
  });
  updateTabsUI();
};

const CHIP_ACTIONS = {
  settings: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && openSettings(tabId),
  run: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && runTabAutomation(tabId),
  audio: (tabId, instance) =>
    instance.state === SHARED.STATE.READY && toggleTabAudio(tabId),
  save: (tabId) => saveTabLogs(tabId),
  clear: (tabId) => clearTabData(tabId),
  close: (tabId) => {
    removeTab(tabId);
    UTILS.tab.exists(tabId).then((exists) => {
      if (exists) chrome.tabs.remove(tabId);
    });
  },
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

const updateTabsUI = () => {
  if (state.tabInstances.size === 0) {
    DOM.tabs.container.innerHTML =
      '<span style="color: var(--text-muted); font-size: 0.75rem;">No tabs connected</span>';
    return;
  }
  const activeTabId = getActiveTabId();
  DOM.tabs.container.innerHTML = "";
  Array.from(state.tabInstances.keys())
    .sort((a, b) => getSequentialId(a) - getSequentialId(b))
    .forEach((tabId) => {
      const instance = state.tabInstances.get(tabId);
      const seqId = getSequentialId(tabId);
      const stateInfo = STATE_INFO[instance.state];
      const isLoading = instance.state === SHARED.STATE.LOADING;
      const icon = getHealthIcon(tabId);
      const spinner = stateInfo.spinner
        ? '<span class="tab-chip-spinner"></span>'
        : "";
      const chip = document.createElement("div");
      chip.className = `tab-chip ${instance.state} ${
        activeTabId === tabId ? "active" : ""
      }`;
      chip.innerHTML = `
        <div class="tab-chip-main">
          <span class="tab-chip-id">${spinner}${
        icon ? icon + " " : ""
      }#${seqId}</span>
        </div>
        <div class="tab-chip-actions">
          ${isLoading ? "" : createChipActions(tabId, instance)}
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
      chip.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        setActiveTab(tabId);
      });
      Object.keys(CHIP_ACTIONS).forEach((action) => {
        const btn = chip.querySelector(`.tab-chip-action.${action}`);
        if (btn) {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            CHIP_ACTIONS[action](tabId, instance);
          });
        }
      });
      DOM.tabs.container.appendChild(chip);
    });
};

const renderActiveTab = () => {
  const activeTabId = getActiveTabId();
  if (activeTabId === null) {
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
  const instance = state.tabInstances.get(activeTabId);
  if (!instance) {
    console.error(`❌ Computed activeTabId ${activeTabId} has no instance!`);
    return;
  }
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
  if (container)
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
    "requestModel",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = ["thinkingChars", "streamingChars"].includes(id)
        ? xhrData[id].toLocaleString()
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
  if (isComplete) {
    cache.cursor.remove();
  } else if (!cache.cursor.parentNode) {
    cache.container.appendChild(cache.cursor);
  }
  if (isAtBottom) {
    requestAnimationFrame(
      () => (bodyContainer.scrollTop = bodyContainer.scrollHeight)
    );
  }
};

const addLogToTab = (tabId, level, msg, meta = {}) => {
  const instance = getTabInstance(tabId);
  if (!instance) return;
  let formattedDuration = "-";
  if (meta.duration != null && !isNaN(meta.duration)) {
    formattedDuration = `${meta.duration.toFixed(1)}ms`;
  }
  instance.logs.push({
    time: UTILS.time.format(UTILS.time.now()),
    level,
    function: meta.name || "-",
    duration: formattedDuration,
    message: msg,
  });
  if (instance.logs.length > SHARED.LIMITS.maxLogsPerTab) {
    instance.logs = instance.logs.slice(-SHARED.LIMITS.maxLogsPerTab);
  }
  if (state.isRestoring) return;
  const activeTabId = getActiveTabId();
  if (activeTabId === tabId) {
    renderLogs(instance.logs);
  } else {
    updateTabsUI();
  }
};

const tryAutoStartAudio = (tabId) => {
  const instance = getTabInstance(tabId);
  if (
    !instance ||
    instance.audio ||
    !instance.autoAudio ||
    instance.state !== SHARED.STATE.READY
  )
    return;
  if (state._audioStarting.has(tabId)) return;
  state._audioStarting.add(tabId);
  let attempts = 0;
  const attemptStart = () => {
    attempts++;
    sendMessageToTab(
      tabId,
      { action: SHARED.MSG.ACTION_START_AUDIO },
      (response) => {
        if (response?.success || response?.alreadyActive) {
          state._audioStarting.delete(tabId);
        } else if (attempts < SHARED.TIMING.audioRetryMax) {
          setTimeout(attemptStart, SHARED.TIMING.audioRetryDelay * attempts);
        } else {
          state._audioStarting.delete(tabId);
        }
      }
    );
  };
  setTimeout(attemptStart, SHARED.TIMING.audioInitialDelay);
};

const updateStatsVisibility = (activeTab) => {
  const activeTabId = getActiveTabId();
  DOM.tabs.stats.classList.remove("active");
  if (activeTabId === null) return;
  const instance = getTabInstance(activeTabId);
  if (!instance) return;
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
