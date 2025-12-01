const addTab = (id, s = SHARED.STATE.LOADING, type = SHARED.TAB_TYPE.REGULAR) => {
  if (state.isRestoring) return setTimeout(() => addTab(id, s, type), 100);
  if (!state.tabs.has(id)) {
    const t = createTab(type);
    t.state = s;
    state.tabs.set(id, t);
    renderUI();
    saveState();
    addLog(id, SHARED.LOG_LEVEL.INFO, `Tab ${SHARED.getTabTypeLabel(type)}${t.seqId} created`, "Tab");
  }
};

const updateTabState = (id, s) => {
  if (state.isRestoring) return setTimeout(() => updateTabState(id, s), 100);
  const t = state.tabs.get(id);
  if (!t || t.state === s) return;
  const old = t.state;
  t.state = s;
  addLog(id, s === SHARED.STATE.ERROR ? SHARED.LOG_LEVEL.ERROR : SHARED.LOG_LEVEL.SUCCESS, `${old} → ${s}`, "Tab");
  renderUI();
  saveState();
};

const removeTab = id => {
  if (!state.tabs.delete(id)) return;
  clearTimeout(state._audioTimeout);
  if (state.activeTabId === id) state.activeTabId = null;
  renderUI();
  saveState();
};

const setActiveTab = id => {
  if (!state.tabs.has(id)) return;
  state.activeTabId = id;
  renderUI();
  saveState();
};

const runAutomation = id => {
  const t = state.tabs.get(id);
  if (!t) return;
  if (t.tabType !== SHARED.TAB_TYPE.REGULAR) {
    return addLog(id, SHARED.LOG_LEVEL.WARN, "Not supported", "Run");
  }
  if (t.state !== SHARED.STATE.READY) {
    return addLog(id, SHARED.LOG_LEVEL.WARN, `Tab is ${t.state}`, "Run");
  }
  const lvl = SHARED.usesThinkingLevel(t.settings.model);
  const s = {
    prompt: t.settings.prompt,
    model: t.settings.model,
    temperature: t.settings.temperature,
    topP: t.settings.topP,
  };
  if (lvl) s.thinkingLevel = t.settings.thinkingLevel;
  else s.thinkingBudget = t.settings.thinkingBudget;
  sendMsg(id, { action: SHARED.MSG.ACTION_RUN, settings: s });
};

const toggleAudio = id => {
  const t = state.tabs.get(id);
  if (!t || t.state !== SHARED.STATE.READY) return;
  sendMsg(id, { action: t.audio ? SHARED.MSG.ACTION_STOP_AUDIO : SHARED.MSG.ACTION_START_AUDIO });
};

const saveLogs = id => {
  const t = state.tabs.get(id);
  if (!t || !t.logs.length) return;
  let txt = `Tab ${SHARED.getTabTypeLabel(t.tabType)}${t.seqId}\n${"=".repeat(40)}\n`;
  t.logs.forEach(l => {
    txt += `${l.time} | ${l.fn.padEnd(12)} | ${l.dur.padStart(8)} | ${l.msg}\n`;
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([txt]));
  a.download = `logs-${t.seqId}-${Date.now()}.txt`;
  a.click();
  addLog(id, SHARED.LOG_LEVEL.SUCCESS, `Saved ${t.logs.length} logs`, "Save");
};

const clearData = id => {
  const t = state.tabs.get(id);
  if (!t || !confirm(`Clear ${SHARED.getTabTypeLabel(t.tabType)}${t.seqId}?`)) return;
  t.logs = [];
  t.xhr = createEmptyXHR();
  if (getActiveTabId() === id) renderActiveTab();
  saveState();
  addLog(id, SHARED.LOG_LEVEL.INFO, "Cleared", "Clear");
};

const copyContent = () => {
  const t = getActiveTab();
  if (!t) return;
  const txt = [t.xhr.thinkingText, t.xhr.streamingText].filter(Boolean).join("\n\n---\n\n");
  if (!txt) return addLog(state.activeTabId, SHARED.LOG_LEVEL.WARN, "No content", "Copy");
  navigator.clipboard
    .writeText(txt)
    .then(() => addLog(state.activeTabId, SHARED.LOG_LEVEL.SUCCESS, `Copied ${txt.length}`, "Copy"))
    .catch(() => addLog(state.activeTabId, SHARED.LOG_LEVEL.ERROR, "Copy failed", "Copy"));
};

const updateTabsUI = () => {
  if (!DOM) return;
  if (!state.tabs.size) {
    DOM.tabsContainer.innerHTML = '<span class="no-tabs-msg">No tabs</span>';
    return;
  }
  const active = getActiveTabId();
  DOM.tabsContainer.innerHTML = "";
  [...state.tabs.entries()]
    .sort(([, a], [, b]) => a.seqId - b.seqId)
    .forEach(([id, t]) => {
      const chip = document.createElement("div");
      chip.className = `tab-chip ${t.state}${active === id ? " active" : ""}`;

      const status = document.createElement("span");
      status.className = `tab-status ${getHealthClass(id)}`;
      chip.appendChild(status);

      const idEl = document.createElement("span");
      idEl.className = "tab-id";
      const letter = document.createElement("span");
      letter.className = `type-letter ${t.tabType}`;
      letter.textContent = SHARED.getTabTypeLabel(t.tabType);
      idEl.appendChild(letter);
      idEl.appendChild(document.createTextNode(t.seqId));
      chip.appendChild(idEl);

      const close = document.createElement("button");
      close.className = "tab-close";
      close.title = "Close";
      close.innerHTML = `<svg viewBox="0 0 24 24">${ICONS.x}</svg>`;
      close.onclick = e => {
        e.stopPropagation();
        removeTab(id);
        UTILS.tab.exists(id).then(ok => ok && chrome.tabs.remove(id));
      };
      chip.appendChild(close);
      chip.onclick = e => !e.target.closest("button") && setActiveTab(id);
      DOM.tabsContainer.appendChild(chip);
    });
};

const updateActionBar = () => {
  const t = getActiveTab();
  const ready = t?.tabType === SHARED.TAB_TYPE.REGULAR && t?.state === SHARED.STATE.READY;

  // Actions: Run | Settings | Audio
  DOM.regular.runBtn.disabled = !ready;
  DOM.regular.settingsDropdown.querySelector(".dropdown-trigger").disabled = !ready;
  DOM.regular.audioBtn.disabled = !ready;
  DOM.regular.moreDropdown.querySelector(".dropdown-trigger").disabled = !t;

  if (DOM.regular.iconAudioOff && DOM.regular.iconAudioOn) {
    DOM.regular.iconAudioOff.style.display = t?.audio ? "none" : "block";
    DOM.regular.iconAudioOn.style.display = t?.audio ? "block" : "none";
  }
};

const renderActiveTab = () => {
  const t = getActiveTab();
  if (!t || t.tabType !== SHARED.TAB_TYPE.REGULAR) {
    renderEmpty();
    return;
  }
  renderLogs(t.logs);
  updateBadges(t.xhr.thinkingChunks, t.xhr.streamingChunks, t.logs.length);
  renderData("thinking", t.xhr.thinkingText, true);
  renderData("streaming", t.xhr.streamingText, true);
};

const renderEmpty = () => {
  DOM.regular.logTableBody.innerHTML = "";
  DOM.regular.thinkingData.innerHTML = "";
  DOM.regular.streamingData.innerHTML = "";
  updateBadges(0, 0, 0);
};

const updateBadges = (think, stream, logs) => {
  DOM.regular.thinkingBadge.textContent = think;
  DOM.regular.streamingBadge.textContent = stream;
  DOM.regular.logsBadge.textContent = logs;
};

const renderLogs = logs => {
  if (!logs.length) {
    DOM.regular.logTableBody.innerHTML = "";
    return;
  }
  DOM.regular.logTableBody.innerHTML = logs
    .map(
      l =>
        `<tr class="${l.level}"><td class="time">${l.time}</td><td class="fn">${l.fn}</td><td class="dur">${l.dur}</td><td class="msg">${l.msg}</td></tr>`
    )
    .join("");
  const c = DOM.regular.logTableBody.closest(".scroll-area");
  if (c) requestAnimationFrame(() => (c.scrollTop = c.scrollHeight));
};

const renderData = (type, text, complete = false) => {
  const el = DOM.regular[`${type}Data`];
  if (!text) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = escapeHtml(text) + (complete ? "" : '<span class="cursor"></span>');
  el.scrollTop = el.scrollHeight;
};

const addLog = (id, level, msg, fn = "-", dur = null) => {
  const t = state.tabs.get(id);
  if (!t) return;
  t.logs.push({
    time: UTILS.time.format(Date.now()),
    level,
    fn,
    dur: dur != null ? `${dur.toFixed(1)}ms` : "-",
    msg,
  });
  if (t.logs.length > SHARED.LIMITS.maxLogsPerTab) {
    t.logs = t.logs.slice(-SHARED.LIMITS.maxLogsPerTab);
  }
  if (state.isRestoring) return;
  if (getActiveTabId() === id && t.tabType === SHARED.TAB_TYPE.REGULAR) {
    renderLogs(t.logs);
    DOM.regular.logsBadge.textContent = t.logs.length;
  }
};

const tryAutoAudio = id => {
  const t = state.tabs.get(id);
  if (!t || t.audio || !t.settings.autoAudio || t.state !== SHARED.STATE.READY) return;
  setTimeout(() => sendMsg(id, { action: SHARED.MSG.ACTION_START_AUDIO }), 500);
};