DOM.settings.closeBtn.onclick = closeSettings;
document.onkeydown = (e) => {
  if (e.key === "Escape" && DOM.settings.modal.classList.contains("active")) {
    closeSettings();
  }
};
const promptInput = document.getElementById("promptInput");
if (promptInput) {
  promptInput.addEventListener("input", (e) => {
    DOM.settings.promptLength.textContent = `${e.target.value.length} chars`;
  });
}
DOM.settings.saveBtn.onclick = saveSettings;
DOM.settings.resetBtn.onclick = resetSettings;
const modelSelect = document.getElementById("modelSelect");
if (modelSelect) {
  modelSelect.addEventListener("change", (e) => {
    const usesLevel = SHARED.usesThinkingLevel(e.target.value);
    document.getElementById("budgetGroup").style.display = usesLevel
      ? "none"
      : "block";
    document.getElementById("levelGroup").style.display = usesLevel
      ? "block"
      : "none";
  });
}
const savedTheme = UTILS.storage.get("theme", "dark");
if (savedTheme === "light") document.body.classList.add("light-theme");
document.querySelectorAll(".tab").forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll(".tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    document.getElementById(`${tab.dataset.tab}Tab`).classList.add("active");
    updateStatsVisibility(tab.dataset.tab);
  };
});
const copyToClipboard = async (text, btnId) => {
  const btn = document.getElementById(btnId);
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = "✅ Copied!";
    setTimeout(() => (btn.textContent = orig), 2000);
  } catch (err) {
    const activeTabId = getActiveTabId();
    if (activeTabId !== null) {
      addLogToTab(activeTabId, SHARED.LOG_LEVEL.ERROR, "Copy failed", {
        name: "Dashboard",
      });
    }
  }
};
DOM.thinking.copyBtn.onclick = () => {
  const activeTabId = getActiveTabId();
  if (activeTabId === null) return;
  const instance = getTabInstance(activeTabId);
  if (!instance) return;
  if (instance.xhrData.thinkingText) {
    copyToClipboard(instance.xhrData.thinkingText, "copyThinking");
  } else {
    addLogToTab(activeTabId, SHARED.LOG_LEVEL.WARN, "No thinking content", {
      name: "Dashboard",
    });
  }
};
DOM.streaming.copyBtn.onclick = () => {
  const activeTabId = getActiveTabId();
  if (activeTabId === null) return;
  const instance = getTabInstance(activeTabId);
  if (!instance) return;
  if (instance.xhrData.streamingText) {
    copyToClipboard(instance.xhrData.streamingText, "copyStreaming");
  } else {
    addLogToTab(activeTabId, SHARED.LOG_LEVEL.WARN, "No streaming content", {
      name: "Dashboard",
    });
  }
};

// ✅ IMMEDIATE UPDATE PATTERN
let isProcessingNewTab = false;
const openNewTab = async () => {
  if (isProcessingNewTab) {
    console.log("⏳ Already creating a tab...");
    return;
  }

  isProcessingNewTab = true;
  console.log("🔵 Requesting new tab from background...");

  try {
    const res = await UTILS.msg.toBackground(SHARED.MSG.OPEN_AI_STUDIO, {
      model: SHARED.DEFAULTS.model,
    });

    if (!res?.success || !res.tabId) {
      console.error("❌ Failed to create tab:", res?.error || "Unknown error");
      return;
    }

    console.log(`✅ Tab creation initiated: ${res.tabId}`);

    // ✅ IMMEDIATE UPDATE - Don't wait for messages!
    state.userCreatedTabs.add(res.tabId);
    state.recentlyClosedTabs.delete(res.tabId);
    addTab(res.tabId, SHARED.STATE.LOADING);
  } catch (err) {
    console.error("❌ Error creating tab:", err);
  } finally {
    setTimeout(() => {
      isProcessingNewTab = false;
    }, 1000);
  }
};

let holdTimer = null;
let isHolding = false;
let eventLock = false;
const toggleTheme = () => {
  document.body.classList.toggle("light-theme");
  const isLight = document.body.classList.contains("light-theme");
  UTILS.storage.set("theme", isLight ? "light" : "dark");
  DOM.tabs.newBtn.style.transform = "scale(1.1)";
  setTimeout(() => (DOM.tabs.newBtn.style.transform = ""), 200);
  const activeTabId = getActiveTabId();
  if (activeTabId !== null) {
    addLogToTab(
      activeTabId,
      SHARED.LOG_LEVEL.INFO,
      `Theme: ${isLight ? "light" : "dark"}`,
      { name: "Theme" }
    );
  }
};
const handleHold = (action) => {
  const actions = {
    start: () => {
      if (eventLock) return;
      eventLock = true;
      isHolding = false;
      DOM.tabs.newBtn.classList.add("holding");
      holdTimer = setTimeout(() => {
        isHolding = true;
        toggleTheme();
      }, 2000);
    },
    end: () => {
      if (!eventLock) return;
      clearTimeout(holdTimer);
      DOM.tabs.newBtn.classList.remove("holding");
      if (!isHolding) openNewTab();
      eventLock = false;
    },
    cancel: () => {
      clearTimeout(holdTimer);
      DOM.tabs.newBtn.classList.remove("holding");
      eventLock = false;
    },
  };
  actions[action]();
};
DOM.tabs.newBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  handleHold("start");
});
DOM.tabs.newBtn.addEventListener("pointerup", (e) => {
  e.preventDefault();
  handleHold("end");
});
DOM.tabs.newBtn.addEventListener("pointerleave", (e) => {
  e.preventDefault();
  handleHold("cancel");
});
DOM.tabs.newBtn.addEventListener("pointercancel", (e) => {
  e.preventDefault();
  handleHold("cancel");
});
DOM.tabs.newBtn.addEventListener("contextmenu", (e) => e.preventDefault());

// ✅ IDEMPOTENT MESSAGE HANDLERS
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    const tabId = msg.tabId || sender.tab?.id;
    const handlers = {
      // ✅ DEFENSIVE ONLY - openNewTab already handles user-created tabs
      [SHARED.MSG.TAB_CREATED]: () => {
        if (!msg.tabId) return;

        // Only handle if NOT user-created (e.g., manual navigation to AI Studio)
        if (!state.userCreatedTabs.has(msg.tabId)) {
          console.log(`📨 TAB_CREATED (external): ${msg.tabId}`);
          state.recentlyClosedTabs.delete(msg.tabId);

          // ✅ Idempotent: Only add if doesn't exist
          if (!state.tabInstances.has(msg.tabId)) {
            addTab(msg.tabId, SHARED.STATE.LOADING);
          }
        } else {
          console.log(`📨 TAB_CREATED (user): ${msg.tabId} - already handled`);
        }
      },

      // ✅ EXTERNAL EVENT - Always handle
      [SHARED.MSG.TAB_REMOVED]: () => {
        if (!msg.tabId) return;
        console.log(`📨 TAB_REMOVED: ${msg.tabId}`);
        removeTab(msg.tabId);
      },

      // ✅ EXTERNAL EVENT - Always handle
      [SHARED.MSG.TAB_ERROR]: () => {
        if (!msg.tabId) return;
        console.log(`📨 TAB_ERROR: ${msg.tabId} - ${msg.error}`);
        updateTabState(msg.tabId, SHARED.STATE.ERROR);
        addLogToTab(
          msg.tabId,
          SHARED.LOG_LEVEL.ERROR,
          msg.error || "Unknown error",
          { name: "TabManager" }
        );
      },

      [SHARED.MSG.LOG]: () => {
        if (tabId) {
          addLogToTab(tabId, msg.level, msg.message, {
            name: msg.name,
            duration: msg.duration,
          });
        }
      },

      // ✅ IDEMPOTENT - Uses centralized updateTab
      [SHARED.MSG.AUDIO_STATUS]: () => {
        if (tabId) {
          const success = updateTab(tabId, { audio: msg.playing });
          if (success) {
            clearTimeout(state._audioSaveTimeout);
            state._audioSaveTimeout = setTimeout(
              () => saveTabInstances(),
              1000
            );
          }
        }
      },

      // ✅ EXTERNAL EVENT - Content script loaded
      [SHARED.MSG.CONTENT_READY]: () => {
        if (!tabId) return;

        // ✅ Protection against recently closed tabs
        if (state.recentlyClosedTabs.has(tabId)) {
          console.log(
            `⛔ Ignoring CONTENT_READY from recently closed tab ${tabId}`
          );
          return;
        }

        // ✅ Wait for restoration to complete (unless user-created)
        if (state.isRestoring && !state.userCreatedTabs.has(tabId)) {
          setTimeout(() => handlers[SHARED.MSG.CONTENT_READY](), 100);
          return;
        }

        console.log(`📨 CONTENT_READY: ${tabId}`);

        // ✅ Idempotent: Check current state
        const instance = state.tabInstances.get(tabId);

        if (instance?.state === SHARED.STATE.READY) {
          console.log(`✓ Tab ${tabId} already ready`);
          return;
        }

        if (state.tabInstances.has(tabId)) {
          // Tab exists, just update state
          updateTabState(tabId, SHARED.STATE.READY);
        } else {
          // Doesn't exist - create it
          if (state.userCreatedTabs.has(tabId)) {
            // Should have been created by openNewTab, but handle race condition
            addTab(tabId, SHARED.STATE.LOADING);
            setTimeout(() => updateTabState(tabId, SHARED.STATE.READY), 50);
          } else {
            // External tab (manual navigation)
            console.log(`📨 External tab became ready: ${tabId}`);
            addTab(tabId, SHARED.STATE.READY);
          }
        }

        tryAutoStartAudio(tabId);
      },

      // ✅ EXTERNAL EVENT - XHR data from AI Studio
      [SHARED.MSG.XHR_EVENT]: () => {
        if (!tabId) return;
        const instance = getTabInstance(tabId);
        if (!instance) return;
        const data = msg.data;
        const activeTabId = getActiveTabId();

        const xhrHandlers = {
          [SHARED.MSG.XHR_READY]: () => {
            addLogToTab(
              tabId,
              SHARED.LOG_LEVEL.SUCCESS,
              "XHR interceptor ready",
              { name: "XHR" }
            );
          },
          [SHARED.MSG.XHR_REQUEST]: () => {
            instance.xhrData = {
              ...createXHRData(),
              model: data.model || "unknown",
            };
            if (!state.isRestoring && activeTabId === tabId) {
              renderXHRData(instance.xhrData);
            }
          },
          [SHARED.MSG.XHR_THINKING]: () => {
            if (data.total) {
              Object.assign(instance.xhrData, {
                thinkingChunks: data.count,
                thinkingChars: data.totalLength,
                thinkingText: data.total,
              });
              if (!state.isRestoring && activeTabId === tabId) {
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
              if (!state.isRestoring && activeTabId === tabId) {
                renderXHRData(instance.xhrData);
                renderContent(tabId, "streaming", data.total, false);
              }
            }
          },
          [SHARED.MSG.XHR_COMPLETE]: () => {
            instance.xhrData.duration = data.duration || 0;
            if (data.thinking) {
              Object.assign(instance.xhrData, {
                thinkingChunks: data.thinkingCount,
                thinkingChars: data.thinking.length,
                thinkingText: data.thinking,
              });
            }
            if (data.streaming) {
              Object.assign(instance.xhrData, {
                streamingChunks: data.streamingCount,
                streamingChars: data.streaming.length,
                streamingText: data.streaming,
              });
            }
            if (!state.isRestoring && activeTabId === tabId) {
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
              if (activeTabButton)
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
    console.error("❌ Message handler error:", err);
  }
  sendResponse({ received: true });
  return true;
});

const initializeWhenReady = () => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeWhenReady);
    return;
  }
  console.log("🚀 Dashboard initializing...");
  console.log("📄 DOM ready");

  restoreTabInstances();

  setTimeout(() => {
    if (!state.isRestoring) {
      startHealthMonitoring();
      startAutoSave();
      console.log("✅ Monitoring started");
    }
  }, 2000);

  window.addEventListener("beforeunload", () => {
    clearTimeout(state._audioSaveTimeout);
    console.log("💾 Saving before unload...");
    saveTabInstances();
    stopHealthMonitoring();
    stopAutoSave();
  });

  setInterval(
    () => UTILS.msg.toBackground(SHARED.MSG.KEEP_ALIVE),
    SHARED.TIMING.keepAliveInterval
  );

  // ✅ Enhanced cleanup with reconciliation
  setInterval(() => {
    if (!state.isRestoring && state.tabInstances.size > 0) {
      cleanupStaleData();
    }
  }, SHARED.TIMING.cleanupInterval);

  // ✅ RECONCILIATION on visibility change
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !state.isRestoring) {
      console.log("👁️ Dashboard visible - reconciling state...");
      reconcileState();
      renderUI();
    }
  });

  // Debug helpers
  window.debugDashboard = () => {
    console.log("=== Dashboard Debug ===");
    console.log("Tabs:", state.tabInstances.size);
    console.log("Active Tab (computed):", getActiveTabId());
    console.log("Preferred Tab:", state.preferredActiveTabId);
    console.log("Is Restoring:", state.isRestoring);
    console.log("User Created:", Array.from(state.userCreatedTabs));
    console.log("Recently Closed:", Array.from(state.recentlyClosedTabs));
    state.tabInstances.forEach((instance, tabId) => {
      const seqId = getSequentialId(tabId);
      console.log(`  Tab ${tabId} (#${seqId}):`, {
        state: instance.state,
        logs: instance.logs.length,
        audio: instance.audio,
        isActive: getActiveTabId() === tabId,
        thinking: instance.xhrData.thinkingChars,
        streaming: instance.xhrData.streamingChars,
      });
    });
  };

  window.forceRender = () => {
    console.log("🔄 Force rendering...");
    renderUI();
  };

  window.clearStorage = () => {
    if (confirm("Clear all saved state? This will reset the dashboard.")) {
      UTILS.storage.remove("dashboardState");
      console.log("✅ Storage cleared. Reload to see effect.");
    }
  };

  console.log("✅ Dashboard ready");
};

initializeWhenReady();
