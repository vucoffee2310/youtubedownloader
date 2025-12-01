let DOM = null;

const initDOM = () => {
  DOM = {
    tabsContainer: document.getElementById("tabsContainer"),
    newTabBtn: document.getElementById("newTabBtn"),
    types: {
      none: document.getElementById("typeNone"),
      regular: document.getElementById("typeRegular"),
      batch: document.getElementById("typeBatch"),
      edit: document.getElementById("typeEdit"),
    },
    regular: {
      actionBar: document.getElementById("regularActionBar"),
      content: document.getElementById("regularContent"),
      actions: document.getElementById("regularActions"),
      views: document.getElementById("regularViews"),
      // Actions: Run | Settings | Audio
      runBtn: document.getElementById("runBtn"),
      settingsDropdown: document.getElementById("settingsDropdown"),
      settingsMenu: document.getElementById("settingsMenu"),
      audioBtn: document.getElementById("audioBtn"),
      iconAudioOff: document.getElementById("iconAudioOff"),
      iconAudioOn: document.getElementById("iconAudioOn"),
      // Settings form
      promptInput: document.getElementById("promptInput"),
      promptLength: document.getElementById("promptLength"),
      modelSelect: document.getElementById("modelSelect"),
      temperatureInput: document.getElementById("temperatureInput"),
      topPInput: document.getElementById("topPInput"),
      budgetInput: document.getElementById("budgetInput"),
      budgetGroup: document.getElementById("budgetGroup"),
      levelSelect: document.getElementById("levelSelect"),
      levelGroup: document.getElementById("levelGroup"),
      autoAudioCheckbox: document.getElementById("autoAudioCheckbox"),
      settingsSaveBtn: document.getElementById("settingsSaveBtn"),
      settingsResetBtn: document.getElementById("settingsResetBtn"),
      // Views: Thinking | Streaming | Logs | More
      thinkingViewBtn: document.getElementById("thinkingViewBtn"),
      streamingViewBtn: document.getElementById("streamingViewBtn"),
      logsViewBtn: document.getElementById("logsViewBtn"),
      moreDropdown: document.getElementById("moreDropdown"),
      moreMenu: document.getElementById("moreMenu"),
      copyBtn: document.getElementById("copyBtn"),
      saveBtn: document.getElementById("saveBtn"),
      clearBtn: document.getElementById("clearBtn"),
      // Badges
      thinkingBadge: document.getElementById("thinkingBadge"),
      streamingBadge: document.getElementById("streamingBadge"),
      logsBadge: document.getElementById("logsBadge"),
      // Content panels
      thinkingView: document.getElementById("thinkingView"),
      streamingView: document.getElementById("streamingView"),
      logsView: document.getElementById("logsView"),
      thinkingData: document.getElementById("thinkingData"),
      streamingData: document.getElementById("streamingData"),
      logTableBody: document.getElementById("logTableBody"),
      // Theme
      themeToggle: document.getElementById("themeToggle"),
    },
    batch: {
      themeToggle: document.getElementById("themeToggleBatch"),
    },
    edit: {
      themeToggle: document.getElementById("themeToggleEdit"),
    },
  };
};

const state = {
  tabs: new Map(),
  nextId: 1,
  activeTabId: null,
  activeView: "logs",
  isRestoring: true,
  _audioTimeout: null,
  _saving: false,
};

const createEmptyXHR = () => ({
  thinkingChunks: 0,
  thinkingChars: 0,
  thinkingText: "",
  streamingChunks: 0,
  streamingChars: 0,
  streamingText: "",
  duration: 0,
});

const createTab = (type = SHARED.TAB_TYPE.REGULAR) => ({
  seqId: state.nextId++,
  tabType: type,
  state: SHARED.STATE.LOADING,
  health: "healthy",
  lastPing: Date.now(),
  audio: false,
  logs: [],
  settings: { ...SHARED.DEFAULTS },
  xhr: createEmptyXHR(),
});

const getActiveTabId = () => (state.tabs.has(state.activeTabId) ? state.activeTabId : null);
const getActiveTab = () => state.tabs.get(getActiveTabId()) || null;
const getActiveTabType = () => getActiveTab()?.tabType || "none";

const getHealthClass = id => {
  const t = state.tabs.get(id);
  if (!t) return "";
  if (t.state === SHARED.STATE.LOADING) return "loading";
  if (t.state === SHARED.STATE.ERROR) return "dead";
  return t.health;
};

const escapeHtml = s => {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
};

const saveState = () => {
  if (state._saving || state.isRestoring) return;
  state._saving = true;
  const data = {};
  state.tabs.forEach((t, id) => {
    data[id] = {
      seqId: t.seqId,
      tabType: t.tabType,
      state: t.state,
      health: t.health,
      audio: t.audio,
      logs: t.logs.slice(-SHARED.LIMITS.maxLogsPerTab),
      settings: { ...t.settings },
      xhr: { ...t.xhr },
    };
  });
  UTILS.storage.set("dashboardState", {
    version: 16,
    tabs: data,
    nextId: state.nextId,
    activeTabId: state.activeTabId,
    activeView: state.activeView,
  });
  state._saving = false;
};

const restoreState = async () => {
  try {
    const saved = UTILS.storage.get("dashboardState");
    if (!saved?.tabs) return;
    const ids = Object.keys(saved.tabs).map(Number);
    const results = await Promise.all(ids.map(async id => ({ id, ok: await UTILS.tab.exists(id) })));
    const valid = results.filter(r => r.ok);
    if (!valid.length) return;

    let maxSeq = 0;
    valid.forEach(({ id }) => {
      if (saved.tabs[id]?.seqId > maxSeq) maxSeq = saved.tabs[id].seqId;
    });
    state.nextId = Math.max(maxSeq + 1, saved.nextId || 1);

    valid.forEach(({ id }) => {
      const s = saved.tabs[id];
      const tab = createTab(s.tabType || SHARED.TAB_TYPE.REGULAR);
      Object.assign(tab, {
        seqId: s.seqId,
        state: s.state || SHARED.STATE.LOADING,
        health: s.health || "healthy",
        audio: s.audio || false,
        logs: s.logs || [],
      });
      if (s.settings) Object.assign(tab.settings, s.settings);
      if (s.xhr) Object.assign(tab.xhr, s.xhr);
      state.tabs.set(id, tab);
    });
    state.activeTabId = saved.activeTabId || null;
    state.activeView = saved.activeView || "logs";
  } catch (e) {
    console.error("Restore:", e);
  } finally {
    state.isRestoring = false;
    renderUI();
  }
};

const showTypeContainer = type => {
  Object.entries(DOM.types).forEach(([t, el]) => {
    el?.classList.toggle("active", t === type);
  });
};

const renderUI = () => {
  if (state.isRestoring || !DOM) return;
  updateTabsUI();
  showTypeContainer(getActiveTabType());
  if (getActiveTabType() === SHARED.TAB_TYPE.REGULAR) {
    setActiveView(state.activeView);
    updateActionBar();
    renderActiveTab();
  }
};

const reconcileState = async () => {
  if (state.isRestoring || !state.tabs.size) return;
  const results = await Promise.all(
    [...state.tabs.keys()].map(async id => ({ id, ok: await UTILS.tab.exists(id) }))
  );
  results.filter(r => !r.ok).forEach(({ id }) => removeTab(id));
};

const sendMsg = (id, msg, cb) => {
  if (!UTILS.validate.tabId(id)) return cb?.(null);
  UTILS.tab.exists(id).then(ok => {
    if (!ok) {
      updateHealth(id, "dead");
      removeTab(id);
      return cb?.(null);
    }
    UTILS.msg.toTab(id, msg, r => {
      updateHealth(id, r ? "healthy" : "degraded");
      cb?.(r);
    });
  });
};

const updateHealth = (id, h) => {
  if (state.isRestoring) return;
  const t = state.tabs.get(id);
  if (t) {
    t.health = h;
    t.lastPing = Date.now();
    updateTabsUI();
  }
};

const pingTab = async id => {
  const t = state.tabs.get(id);
  if (!t || t.state !== SHARED.STATE.READY) return;
  try {
    const r = await Promise.race([
      UTILS.msg.toContent(id, SHARED.MSG.ACTION_PING),
      new Promise((_, rej) => setTimeout(rej, SHARED.TIMING.pingTimeout)),
    ]);
    updateHealth(id, r?.pong ? "healthy" : "degraded");
  } catch {
    updateHealth(id, "dead");
  }
};

let intervalsOn = false;
const startIntervals = () => {
  if (intervalsOn || state.isRestoring) return;
  intervalsOn = true;
  setInterval(() => {
    if (!state.isRestoring) state.tabs.forEach((_, id) => pingTab(id));
  }, SHARED.TIMING.healthCheckInterval);
  setInterval(() => {
    if (!state.isRestoring) saveState();
  }, SHARED.TIMING.autoSaveInterval);
};

const closeDropdowns = () => {
  document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
};

const populateSettings = () => {
  const t = getActiveTab();
  if (!t) return;
  const s = t.settings;
  DOM.regular.promptInput.value = s.prompt || "";
  DOM.regular.promptLength.textContent = (s.prompt || "").length;
  DOM.regular.modelSelect.value = s.model;
  DOM.regular.temperatureInput.value = s.temperature;
  DOM.regular.topPInput.value = s.topP;
  DOM.regular.budgetInput.value = s.thinkingBudget;
  DOM.regular.levelSelect.value = s.thinkingLevel || "high";
  DOM.regular.autoAudioCheckbox.checked = s.autoAudio;
  updateSettingsVis(s.model);
};

const updateSettingsVis = m => {
  const lvl = SHARED.usesThinkingLevel(m);
  DOM.regular.budgetGroup.style.display = lvl ? "none" : "block";
  DOM.regular.levelGroup.style.display = lvl ? "block" : "none";
};

const saveSettings = () => {
  const t = getActiveTab();
  if (!t) return;
  const m = DOM.regular.modelSelect.value;
  const lvl = SHARED.usesThinkingLevel(m);
  Object.assign(t.settings, {
    prompt: DOM.regular.promptInput.value,
    model: m,
    temperature: parseFloat(DOM.regular.temperatureInput.value),
    topP: parseFloat(DOM.regular.topPInput.value),
    thinkingBudget: lvl ? SHARED.DEFAULTS.thinkingBudget : parseInt(DOM.regular.budgetInput.value),
    thinkingLevel: lvl ? DOM.regular.levelSelect.value : SHARED.DEFAULTS.thinkingLevel,
    autoAudio: DOM.regular.autoAudioCheckbox.checked,
  });
  addLog(state.activeTabId, SHARED.LOG_LEVEL.SUCCESS, "Settings saved", "Settings");
  saveState();
  closeDropdowns();
};

const resetSettings = () => {
  DOM.regular.promptInput.value = SHARED.DEFAULTS.prompt;
  DOM.regular.promptLength.textContent = SHARED.DEFAULTS.prompt.length;
  DOM.regular.modelSelect.value = SHARED.DEFAULTS.model;
  DOM.regular.temperatureInput.value = SHARED.DEFAULTS.temperature;
  DOM.regular.topPInput.value = SHARED.DEFAULTS.topP;
  DOM.regular.budgetInput.value = SHARED.DEFAULTS.thinkingBudget;
  DOM.regular.levelSelect.value = SHARED.DEFAULTS.thinkingLevel;
  DOM.regular.autoAudioCheckbox.checked = SHARED.DEFAULTS.autoAudio;
  updateSettingsVis(SHARED.DEFAULTS.model);
};

const setActiveView = view => {
  state.activeView = view;
  // Update view buttons: Thinking | Streaming | Logs
  [DOM.regular.thinkingViewBtn, DOM.regular.streamingViewBtn, DOM.regular.logsViewBtn].forEach(b =>
    b.classList.remove("active")
  );
  // Update view panels
  [DOM.regular.thinkingView, DOM.regular.streamingView, DOM.regular.logsView].forEach(v =>
    v.classList.remove("active")
  );
  DOM.regular[`${view}ViewBtn`].classList.add("active");
  DOM.regular[`${view}View`].classList.add("active");
};