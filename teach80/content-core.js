(function () {
  if (window.AStudioAutomatorLoaded) return;
  window.AStudioAutomatorLoaded = true;

  window.addEventListener("beforeunload", () => {
    window.Chat?.stop();
    window.Audio?.stop();
  });

  // Config
  window.CONFIG = {
    ...SHARED.DEFAULTS,
    autoDeleteChats: true,
    autoStopRunning: true,
    showProgress: true,
    logEveryNChunks: 5,
  };

  // Selectors
  window.SEL = {
    navbar: {
      toggle: 'ms-toolbar button[aria-label="Toggle navigation menu"]',
      content: "div.nav-content",
    },
    panel: {
      open: 'button[aria-label="Toggle run settings panel"]',
      container: "ms-right-side-panel",
      content: "div.content-container",
      temp: '[data-test-id="temperatureSliderContainer"]',
      budgetToggle: '[data-test-toggle="manual-budget"] button[role="switch"]',
      budget: '[data-test-id="user-setting-budget-animation-wrapper"]',
      searchToggle: '[data-test-id="searchAsAToolTooltip"] button[role="switch"]',
      topP: '[mattooltip="Probability threshold for top-p sampling"]',
      close: 'button[aria-label="Close run settings panel"]',
      thinkingLevel: "ms-thinking-level-setting mat-select",
    },
    chat: {
      turn: "ms-chat-turn",
      options: 'button[aria-label="Open options"]',
    },
    prompt: {
      textarea: "ms-prompt-input-wrapper textarea",
      runButton: "ms-run-button button",
    },
  };

  // Log colors
  const LOG_COLORS = {
    [SHARED.LOG_LEVEL.SUCCESS]: "#2ecc71",
    [SHARED.LOG_LEVEL.ERROR]: "#e74c3c",
    [SHARED.LOG_LEVEL.INFO]: "#3498db",
    [SHARED.LOG_LEVEL.THINK]: "#9b59b6",
    [SHARED.LOG_LEVEL.STREAM]: "#1abc9c",
    [SHARED.LOG_LEVEL.WARN]: "#f39c12",
  };

  let lastSettingsStamp = null;

  // Logging
  window.log = (level, msg, fn = null, start = null) => {
    const dur = start ? (performance.now() - start).toFixed(1) : null;
    const prefix = fn ? `[${fn}]` : "";
    const suffix = dur ? `⏱️${dur}ms` : "";
    console.log(`%c${[prefix, msg, suffix].filter(Boolean).join(" ")}`, `color: ${LOG_COLORS[level] || "#999"}`);
    UTILS.msg.toBackground(SHARED.MSG.LOG, {
      level,
      message: msg,
      name: fn || "unknown",
      duration: dur ? parseFloat(dur) : null,
      timestamp: UTILS.time.iso(),
    });
  };

  // Config update
  window.updateConfig = settings => {
    Object.keys(settings).forEach(k => {
      if (settings[k] !== undefined) window.CONFIG[k] = settings[k];
    });
    lastSettingsStamp = null;
    window.log(SHARED.LOG_LEVEL.SUCCESS, `Config: ${window.CONFIG.prompt.substring(0, 40)}...`, "updateConfig");
  };

  // State management
  window.State = {
    running: false,
    lastComplete: 0,
    acquire() {
      const now = Date.now();
      if (this.running || now - this.lastComplete < SHARED.TIMING.cooldown) {
        UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, { running: false, locked: true });
        return false;
      }
      this.running = true;
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, { running: true, locked: true });
      return true;
    },
    release() {
      this.running = false;
      this.lastComplete = Date.now();
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, { running: false, locked: false });
    },
  };

  // DOM helpers
  window.wait = (selOrFn, timeout = 6000, scope = document, watchAttr = false) =>
    UTILS.dom.wait(selOrFn, timeout, scope, watchAttr);

  window.click = async (sel, scope = document, delay = SHARED.TIMING.click) => {
    const el = await window.wait(sel, 6000, scope);
    await UTILS.dom.click(el, delay);
    return el;
  };

  window.setInput = (sel, val, scope = document) => {
    const input = scope.querySelector(sel)?.querySelector('input[type="number"]');
    if (input && parseFloat(input.value) !== val) {
      UTILS.dom.typeInput(input, val);
      input.focus();
      input.blur();
      return true;
    }
    return false;
  };

  window.getButton = () => {
    const btn = document.querySelector(window.SEL.prompt.runButton);
    if (!btn) return null;
    const label = btn.querySelector(".label")?.textContent?.trim() || btn.getAttribute("aria-label");
    const disabled = btn.disabled || btn.classList.contains("disabled");
    const stoppable = btn.classList.contains("stoppable");
    return {
      button: btn,
      label,
      isStop: label === "Stop" || stoppable,
      isRun: label === "Run" && !stoppable,
      enabled: !disabled,
    };
  };

  window.setThinkingLevel = async (level, scope = document) => {
    try {
      const selectEl = scope.querySelector(window.SEL.panel.thinkingLevel);
      if (!selectEl) return false;

      const currentEl = selectEl.querySelector(".mat-mdc-select-value-text .mat-mdc-select-min-line");
      const current = currentEl?.textContent.trim().toLowerCase() || "";
      const target = level.toLowerCase();
      if (current === target) return true;

      selectEl.click();
      await new Promise(r => setTimeout(r, SHARED.TIMING.selectDropdown));

      const panel = await window.wait(() => {
        const p = document.querySelector('div[role="listbox"][aria-label="Thinking Level"]');
        if (p) {
          const opts = p.querySelectorAll('mat-option[role="option"]');
          return opts.length > 0 ? { panel: p, options: opts } : null;
        }
        return null;
      }, 3000, document.body);

      if (!panel) {
        document.body.click();
        return false;
      }

      for (const opt of panel.options) {
        const txt = opt.querySelector(".mdc-list-item__primary-text");
        if (txt?.textContent.trim().toLowerCase() === target) {
          opt.click();
          await new Promise(r => setTimeout(r, SHARED.TIMING.panelAction));
          const newEl = selectEl.querySelector(".mat-mdc-select-value-text .mat-mdc-select-min-line");
          return newEl?.textContent.trim().toLowerCase() === target;
        }
      }
      return false;
    } catch (err) {
      window.log(SHARED.LOG_LEVEL.ERROR, err.message, "setThinkingLevel");
      document.body.click();
      return false;
    }
  };

  // Chat deletion
  window.Chat = {
    observer: null,
    active: false,
    count: 0,
    pending: Promise.resolve(),

    async _doDelete(turn) {
      const start = performance.now();
      try {
        const btn = turn.querySelector(window.SEL.chat.options);
        if (!btn) return false;
        btn.click();
        await new Promise(r => setTimeout(r, SHARED.TIMING.optionsClick));

        const menu = await window.wait('div[role="menu"].mat-mdc-menu-panel', 1500);
        if (!menu) return false;

        const del = Array.from(menu.querySelectorAll('button[role="menuitem"]')).find(b =>
          b.textContent.includes("Delete")
        );
        if (del) {
          del.click();
          await new Promise(r => setTimeout(r, SHARED.TIMING.deleteClick));
          this.count++;
          window.log(SHARED.LOG_LEVEL.SUCCESS, `🗑️ #${this.count}`, "Chat.delete", start);
          return true;
        }
      } catch (err) {
        window.log(SHARED.LOG_LEVEL.ERROR, err.message, "Chat.delete", start);
      }
      return false;
    },

    deleteOne(turn) {
      if (!this.active) return Promise.resolve(false);
      this.pending = this.pending.then(() => (this.active ? this._doDelete(turn) : false));
      return this.pending;
    },

    async processNodes(nodes) {
      for (const node of nodes) {
        if (!this.active || node.nodeType !== Node.ELEMENT_NODE) break;
        if (node.matches?.(window.SEL.chat.turn)) {
          await this.deleteOne(node);
        } else {
          const turns = node.querySelectorAll?.(window.SEL.chat.turn) || [];
          for (const turn of turns) {
            if (!this.active) break;
            await this.deleteOne(turn);
          }
        }
      }
    },

    processExisting() {
      const turns = document.querySelectorAll(window.SEL.chat.turn);
      if (turns.length) this.processNodes(turns);
    },

    handleMutation(mutations) {
      if (!this.active) return;
      for (const mut of mutations) {
        if (!this.active) break;
        this.processNodes(mut.addedNodes);
      }
    },

    start() {
      if (this.active) return;
      this.active = true;
      this.count = 0;
      this.pending = Promise.resolve();
      this.processExisting();
      this.observer = new MutationObserver(this.handleMutation.bind(this));
      this.observer.observe(document.querySelector("ms-app") || document.body, { childList: true, subtree: true });
      UTILS.msg.toBackground(SHARED.MSG.AUTO_DELETE_STATUS, { active: true, count: 0 });
    },

    stop() {
      if (!this.active) return;
      this.observer?.disconnect();
      this.observer = null;
      this.active = false;
      UTILS.msg.toBackground(SHARED.MSG.AUTO_DELETE_STATUS, { active: false, count: this.count });
      this.count = 0;
    },
  };

  // Audio keep-alive
  window.Audio = {
    ctx: null,
    osc: null,
    active: false,

    async start() {
      if (this.active) return { success: true, alreadyActive: true };
      try {
        this.ctx = new AudioContext();
        if (this.ctx.state === "suspended") await this.ctx.resume();
        this.osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        this.osc.frequency.value = 1;
        gain.gain.value = 0.001;
        this.osc.connect(gain).connect(this.ctx.destination);
        this.osc.start();
        this.active = true;
        UTILS.msg.toBackground(SHARED.MSG.AUDIO_STATUS, { playing: true });
        return { success: true };
      } catch (err) {
        this.ctx?.close();
        this.ctx = this.osc = null;
        return { success: false, error: err.message };
      }
    },

    stop() {
      try {
        this.osc?.stop();
        this.ctx?.close();
      } catch {}
      this.osc = this.ctx = null;
      this.active = false;
      UTILS.msg.toBackground(SHARED.MSG.AUDIO_STATUS, { playing: false });
      return { success: true };
    },
  };

  // Settings stamp for change detection
  const getSettingsStamp = () =>
    JSON.stringify({
      t: window.CONFIG.temperature,
      p: window.CONFIG.topP,
      b: window.CONFIG.thinkingBudget,
      l: window.CONFIG.thinkingLevel,
    });

  // Automation
  window.Auto = {
    async run() {
      await window.wait("ms-app");
      await this.navbar();
      await this.panel();
      await this.send();
    },

    async navbar() {
      const nav = await window.wait(window.SEL.navbar.content);
      if (nav?.classList.contains("expanded")) {
        await window.click(window.SEL.navbar.toggle);
      }
    },

    async panel() {
      const panel = await window.wait(window.SEL.panel.container);
      if (!panel) return;

      const stamp = getSettingsStamp();
      if (lastSettingsStamp === stamp) return;

      if (!panel.querySelector(window.SEL.panel.content)) {
        await window.click(window.SEL.panel.open);
        await window.wait(window.SEL.panel.content, 2000, panel);
      }

      const usesLevel = SHARED.usesThinkingLevel(window.CONFIG.model);
      let changed = false;

      if (usesLevel) {
        changed = window.setInput(window.SEL.panel.temp, window.CONFIG.temperature, panel) || changed;
        changed = (await window.setThinkingLevel(window.CONFIG.thinkingLevel, panel)) || changed;
        changed = window.setInput(window.SEL.panel.topP, window.CONFIG.topP, panel) || changed;
      } else {
        const budgetToggle = panel.querySelector(window.SEL.panel.budgetToggle);
        if (budgetToggle?.getAttribute("aria-checked") === "false") {
          budgetToggle.click();
          await new Promise(r => setTimeout(r, SHARED.TIMING.panelAction));
        }
        changed = window.setInput(window.SEL.panel.temp, window.CONFIG.temperature, panel) || changed;
        changed = window.setInput(window.SEL.panel.budget, window.CONFIG.thinkingBudget, panel) || changed;
        changed = window.setInput(window.SEL.panel.topP, window.CONFIG.topP, panel) || changed;
      }

      const searchToggle = panel.querySelector(window.SEL.panel.searchToggle);
      if (searchToggle?.getAttribute("aria-checked") === "true") {
        searchToggle.click();
        changed = true;
      }

      if (changed) await new Promise(r => setTimeout(r, SHARED.TIMING.panelAction));
      lastSettingsStamp = stamp;
      await window.click(window.SEL.panel.close, panel, 100);
    },

    async send() {
      let state = window.getButton();
      if (!state?.button) throw new Error("Run button not found");

      if (state.isStop && window.CONFIG.autoStopRunning) {
        if (window.CONFIG.autoDeleteChats) window.Chat.stop();
        state.button.click();
        state = await window.wait(
          () => {
            const s = window.getButton();
            return s?.isRun ? s : null;
          },
          30000,
          document.querySelector("ms-run-button") || document.body,
          true
        );
        await new Promise(r => setTimeout(r, SHARED.TIMING.stopProcess));
      }

      const textarea = await window.wait(window.SEL.prompt.textarea);
      if (!textarea) throw new Error("Textarea not found");

      textarea.value = "";
      textarea.focus();
      UTILS.dom.typeInput(textarea, window.CONFIG.prompt);

      state = await window.wait(
        () => {
          const s = window.getButton();
          return s?.isRun && s.enabled ? s : null;
        },
        8000,
        document.querySelector("ms-run-button") || document.body,
        true
      );
      if (!state) throw new Error("Button not enabled");
      state.button.click();
    },
  };
})();