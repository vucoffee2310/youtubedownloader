const toggleTheme = () => {
  document.body.classList.toggle("light-theme");
  UTILS.storage.set("theme", document.body.classList.contains("light-theme") ? "light" : "dark");
};

const initUI = () => {
  initDOM();
  if (UTILS.storage.get("theme") === "light") {
    document.body.classList.add("light-theme");
  }

  document.addEventListener("click", e => {
    if (!e.target.closest(".dropdown")) closeDropdowns();
  });
  document.onkeydown = e => e.key === "Escape" && closeDropdowns();

  // Regular: Settings
  DOM.regular.promptInput?.addEventListener("input", e => {
    DOM.regular.promptLength.textContent = e.target.value.length;
  });
  DOM.regular.modelSelect?.addEventListener("change", e => updateSettingsVis(e.target.value));
  DOM.regular.settingsSaveBtn?.addEventListener("click", saveSettings);
  DOM.regular.settingsResetBtn?.addEventListener("click", resetSettings);

  // Dropdowns
  document.querySelectorAll(".dropdown .dropdown-trigger").forEach(trigger => {
    trigger.onclick = e => {
      e.stopPropagation();
      const dd = trigger.closest(".dropdown");
      const open = dd.classList.contains("open");
      closeDropdowns();
      if (!open) {
        dd.classList.add("open");
        if (dd === DOM.regular.settingsDropdown) populateSettings();
      }
    };
  });
  document.querySelectorAll(".dropdown-menu").forEach(m => (m.onclick = e => e.stopPropagation()));

  // Regular: View Buttons (Thinking | Streaming | Logs)
  DOM.regular.thinkingViewBtn?.addEventListener("click", () => setActiveView("thinking"));
  DOM.regular.streamingViewBtn?.addEventListener("click", () => setActiveView("streaming"));
  DOM.regular.logsViewBtn?.addEventListener("click", () => setActiveView("logs"));

  // Regular: Action Buttons (Run | Settings | Audio)
  DOM.regular.runBtn?.addEventListener("click", () => {
    const id = getActiveTabId();
    if (id) runAutomation(id);
  });
  DOM.regular.audioBtn?.addEventListener("click", () => {
    const id = getActiveTabId();
    if (id) toggleAudio(id);
  });

  // Regular: More menu
  DOM.regular.copyBtn?.addEventListener("click", () => {
    copyContent();
    closeDropdowns();
  });
  DOM.regular.saveBtn?.addEventListener("click", () => {
    const id = getActiveTabId();
    if (id) saveLogs(id);
    closeDropdowns();
  });
  DOM.regular.clearBtn?.addEventListener("click", () => {
    const id = getActiveTabId();
    if (id) clearData(id);
    closeDropdowns();
  });

  // Theme toggles
  [DOM.regular.themeToggle, DOM.batch.themeToggle, DOM.edit.themeToggle].forEach(b => {
    if (b) b.onclick = toggleTheme;
  });

  // New tab
  let busy = false;
  DOM.newTabBtn.onclick = async () => {
    if (busy) return;
    busy = true;
    try {
      const r = await UTILS.msg.toBackground(SHARED.MSG.OPEN_AI_STUDIO, { model: SHARED.DEFAULTS.model });
      if (r?.success && r.tabId) {
        addTab(r.tabId, SHARED.STATE.LOADING, SHARED.TAB_TYPE.REGULAR);
      }
    } finally {
      setTimeout(() => (busy = false), 1000);
    }
  };

  showTypeContainer("none");
};

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  try {
    const id = msg.tabId || sender.tab?.id;
    const handlers = {
      [SHARED.MSG.TAB_CREATED]: () => {
        if (msg.tabId && !state.tabs.has(msg.tabId)) {
          addTab(msg.tabId, SHARED.STATE.LOADING, msg.tabType || SHARED.TAB_TYPE.REGULAR);
        }
      },
      [SHARED.MSG.TAB_REMOVED]: () => msg.tabId && removeTab(msg.tabId),
      [SHARED.MSG.TAB_ERROR]: () => {
        if (msg.tabId) {
          updateTabState(msg.tabId, SHARED.STATE.ERROR);
          addLog(msg.tabId, SHARED.LOG_LEVEL.ERROR, msg.error || "Error", "Tab");
        }
      },
      [SHARED.MSG.LOG]: () => id && addLog(id, msg.level, msg.message, msg.name, msg.duration),
      [SHARED.MSG.AUDIO_STATUS]: () => {
        if (!id) return;
        const t = state.tabs.get(id);
        if (t) {
          t.audio = msg.playing;
          clearTimeout(state._audioTimeout);
          state._audioTimeout = setTimeout(saveState, 1000);
          updateTabsUI();
          if (t.tabType === SHARED.TAB_TYPE.REGULAR) updateActionBar();
        }
      },
      [SHARED.MSG.CONTENT_READY]: () => {
        if (!id) return;
        if (state.isRestoring) return setTimeout(() => handlers[SHARED.MSG.CONTENT_READY](), 100);
        const t = state.tabs.get(id);
        if (t?.state === SHARED.STATE.READY) return;
        if (state.tabs.has(id)) {
          updateTabState(id, SHARED.STATE.READY);
        } else {
          addTab(id, SHARED.STATE.READY, SHARED.TAB_TYPE.REGULAR);
        }
        tryAutoAudio(id);
      },
      [SHARED.MSG.XHR_EVENT]: () => {
        if (!id) return;
        const t = state.tabs.get(id);
        if (!t || t.tabType !== SHARED.TAB_TYPE.REGULAR) return;
        const d = msg.data;
        const active = getActiveTabId() === id;
        const xhrHandlers = {
          [SHARED.MSG.XHR_READY]: () => addLog(id, SHARED.LOG_LEVEL.SUCCESS, "XHR ready", "XHR"),
          [SHARED.MSG.XHR_REQUEST]: () => {
            t.xhr = createEmptyXHR();
            if (!state.isRestoring && active) {
              updateBadges(0, 0, t.logs.length);
              renderData("thinking", "", true);
              renderData("streaming", "", true);
            }
          },
          [SHARED.MSG.XHR_THINKING]: () => {
            if (!d.total) return;
            t.xhr.thinkingChunks = d.count;
            t.xhr.thinkingChars = d.totalLength;
            t.xhr.thinkingText = d.total;
            if (!state.isRestoring && active) {
              DOM.regular.thinkingBadge.textContent = d.count;
              renderData("thinking", d.total, false);
            }
          },
          [SHARED.MSG.XHR_STREAMING]: () => {
            if (!d.total) return;
            t.xhr.streamingChunks = d.count;
            t.xhr.streamingChars = d.totalLength;
            t.xhr.streamingText = d.total;
            if (!state.isRestoring && active) {
              DOM.regular.streamingBadge.textContent = d.count;
              renderData("streaming", d.total, false);
            }
          },
          [SHARED.MSG.XHR_COMPLETE]: () => {
            t.xhr.duration = d.duration || 0;
            if (d.thinking) {
              t.xhr.thinkingChunks = d.thinkingCount;
              t.xhr.thinkingChars = d.thinking.length;
              t.xhr.thinkingText = d.thinking;
            }
            if (d.streaming) {
              t.xhr.streamingChunks = d.streamingCount;
              t.xhr.streamingChars = d.streaming.length;
              t.xhr.streamingText = d.streaming;
            }
            if (!state.isRestoring && active) {
              updateBadges(t.xhr.thinkingChunks, t.xhr.streamingChunks, t.logs.length);
              renderData("thinking", t.xhr.thinkingText, true);
              renderData("streaming", t.xhr.streamingText, true);
            }
            saveState();
          },
          [SHARED.MSG.XHR_ERROR]: () => addLog(id, SHARED.LOG_LEVEL.ERROR, d.message || "XHR Error", "XHR"),
        };
        xhrHandlers[d.type]?.();
      },
    };
    handlers[msg.type]?.();
  } catch (e) {
    console.error("Msg:", e);
  }
  respond({ ok: true });
  return true;
});

const init = () => {
  if (document.readyState === "loading") {
    return document.addEventListener("DOMContentLoaded", init);
  }
  initUI();
  restoreState();
  setTimeout(() => !state.isRestoring && startIntervals(), 2000);
  window.onbeforeunload = () => {
    clearTimeout(state._audioTimeout);
    saveState();
  };
  setInterval(() => UTILS.msg.toBackground(SHARED.MSG.KEEP_ALIVE), SHARED.TIMING.keepAliveInterval);
  setInterval(() => !state.isRestoring && state.tabs.size && reconcileState(), SHARED.TIMING.cleanupInterval);
  document.onvisibilitychange = () => {
    if (!document.hidden && !state.isRestoring) {
      reconcileState();
      renderUI();
    }
  };
};

init();