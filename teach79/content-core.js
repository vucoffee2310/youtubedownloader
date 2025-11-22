(function () {
  if (window.AStudioAutomatorLoaded) return;
  window.AStudioAutomatorLoaded = true;
  const INIT_KEY = "astudio_automator_init_" + Date.now();
  if (sessionStorage.getItem("astudio_automator_loaded")) return;
  sessionStorage.setItem("astudio_automator_loaded", INIT_KEY);
  window.addEventListener("beforeunload", () => {
    window.Chat?.stop();
    window.Audio?.stop();
    window.State?.clear();
    sessionStorage.removeItem("astudio_automator_loaded");
  });
  window.CONFIG = {
    ...SHARED.DEFAULTS,
    autoDeleteChats: true,
    autoStopRunning: true,
    showProgress: true,
    logEveryNChunks: 5,
  };
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
      searchToggle:
        '[data-test-id="searchAsAToolTooltip"] button[role="switch"]',
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
  const LOG_COLORS = {
    [SHARED.LOG_LEVEL.SUCCESS]: "#2ecc71",
    [SHARED.LOG_LEVEL.ERROR]: "#e74c3c",
    [SHARED.LOG_LEVEL.INFO]: "#3498db",
    [SHARED.LOG_LEVEL.THINK]: "#9b59b6",
    [SHARED.LOG_LEVEL.STREAM]: "#1abc9c",
    [SHARED.LOG_LEVEL.NETWORK]: "#95a5a6",
    [SHARED.LOG_LEVEL.WARN]: "#f39c12",
  };
  window.log = (level, msg, fn = null, start = null) => {
    const duration = start ? (performance.now() - start).toFixed(1) : null;
    const prefix = fn ? `[${fn}]` : "";
    const suffix = duration ? `⏱️${duration}ms` : "";
    const fullMsg = [prefix, msg, suffix].filter(Boolean).join(" ");
    console.log(`%c${fullMsg}`, `color: ${LOG_COLORS[level] || "#999"}`);
    UTILS.msg.toBackground(SHARED.MSG.LOG, {
      level,
      message: msg,
      name: fn || "unknown",
      duration: duration ? parseFloat(duration) : null,
      timestamp: UTILS.time.iso(),
    });
  };
  window.updateConfig = (settings) => {
    Object.keys(settings).forEach((key) => {
      if (settings[key] !== undefined) window.CONFIG[key] = settings[key];
    });
    window.log(
      SHARED.LOG_LEVEL.SUCCESS,
      `Config updated: ${window.CONFIG.prompt.substring(0, 40)}...`,
      "updateConfig"
    );
  };
  window.State = {
    running: false,
    lockTime: null,
    lastComplete: null,
    lastAttempt: 0,
    rejectCount: 0,
    penaltyUntil: null,
    tabId: null,
    save() {
      try {
        if (!this.tabId) {
          this.tabId = `tab_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        }
        const stateData = {
          running: this.running,
          lockTime: this.lockTime,
          lastComplete: this.lastComplete,
          lastAttempt: this.lastAttempt,
          rejectCount: this.rejectCount,
          penaltyUntil: this.penaltyUntil,
          timestamp: UTILS.time.now(),
          tabId: this.tabId,
          version: 1,
        };
        const existing = sessionStorage.getItem("automationState");
        if (existing) {
          const parsed = JSON.parse(existing);
          if (parsed.tabId && parsed.tabId !== this.tabId) {
            const lockAge = UTILS.time.now() - (parsed.lockTime || 0);
            if (lockAge < SHARED.LIMITS.stateTimeout) return;
          }
        }
        sessionStorage.setItem("automationState", JSON.stringify(stateData));
      } catch (err) {
        console.error("State save failed:", err);
      }
    },
    restore() {
      try {
        const saved = sessionStorage.getItem("automationState");
        if (!saved) return;
        const data = JSON.parse(saved);
        const now = UTILS.time.now();
        if (data.timestamp && now - data.timestamp > 300000) {
          sessionStorage.removeItem("automationState");
          return;
        }
        if (data.tabId && data.lockTime) {
          const lockAge = now - data.lockTime;
          if (lockAge < SHARED.LIMITS.stateTimeout) return;
        }
        Object.assign(this, {
          running: data.running || false,
          lockTime: data.lockTime,
          lastComplete: data.lastComplete,
          lastAttempt: data.lastAttempt || 0,
          rejectCount: data.rejectCount || 0,
          penaltyUntil: data.penaltyUntil,
        });
        if (
          this.running &&
          this.lockTime &&
          now - this.lockTime > SHARED.LIMITS.stateTimeout
        ) {
          this.running = false;
          this.lockTime = null;
        }
        UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
          running: this.running,
          locked: this.running,
          restored: true,
        });
      } catch (err) {
        sessionStorage.removeItem("automationState");
      }
    },
    clear() {
      try {
        sessionStorage.removeItem("automationState");
      } catch {}
    },
    checkPenalty(now) {
      if (!this.penaltyUntil || now >= this.penaltyUntil) {
        if (this.penaltyUntil) {
          this.penaltyUntil = null;
          this.rejectCount = 0;
          this.save();
        }
        return false;
      }
      const remaining = Math.ceil((this.penaltyUntil - now) / 1000);
      window.log(
        SHARED.LOG_LEVEL.ERROR,
        `🚫 PENALTY! Wait ${remaining}s`,
        "State.checkPenalty"
      );
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
        running: false,
        locked: true,
        penalty: true,
        remainingSeconds: remaining,
      });
      return true;
    },
    acquire() {
      const fn = "State.acquire";
      const start = performance.now();
      const now = UTILS.time.now();
      if (this.checkPenalty(now)) return false;
      const timeSince = now - this.lastAttempt;
      if (timeSince < SHARED.TIMING.stateDebounce) {
        this.rejectCount++;
        if (this.rejectCount >= SHARED.LIMITS.maxRejects) {
          this.penaltyUntil = now + SHARED.TIMING.statePenalty;
          this.save();
          window.log(
            SHARED.LOG_LEVEL.ERROR,
            `🚫 SPAM! ${SHARED.TIMING.statePenalty / 1000}s penalty`,
            fn,
            start
          );
          UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
            running: false,
            locked: true,
            penalty: true,
            remainingSeconds: SHARED.TIMING.statePenalty / 1000,
          });
        }
        return false;
      }
      this.rejectCount = 0;
      this.lastAttempt = now;
      if (
        this.lastComplete &&
        now - this.lastComplete < SHARED.TIMING.cooldown
      ) {
        return false;
      }
      if (this.running) {
        const elapsed = now - this.lockTime;
        if (elapsed > SHARED.LIMITS.stateTimeout) {
          this.release();
        } else {
          return false;
        }
      }
      this.running = true;
      this.lockTime = now;
      this.save();
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
        running: true,
        locked: true,
      });
      return true;
    },
    release() {
      this.running = false;
      this.lockTime = null;
      this.lastComplete = UTILS.time.now();
      this.save();
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
        running: false,
        locked: false,
      });
    },
  };
  window.wait = (sel, timeout, scope) => UTILS.dom.wait(sel, timeout, scope);
  window.click = async (sel, scope = document, delay = SHARED.TIMING.click) => {
    const el = await window.wait(sel, 6000, scope);
    await UTILS.dom.click(el, delay);
    return el;
  };
  window.setInput = (sel, val, scope = document) => {
    const input = scope
      .querySelector(sel)
      ?.querySelector('input[type="number"]');
    if (input && parseFloat(input.value) !== val) {
      UTILS.dom.typeInput(input, val);
      input.focus();
      input.blur();
      return true;
    }
    return false;
  };
  window.setThinkingLevel = async (level, scope = document) => {
    const fn = "setThinkingLevel";
    try {
      const selectEl = scope.querySelector(window.SEL.panel.thinkingLevel);
      if (!selectEl) return false;
      const currentValueEl = selectEl.querySelector(
        ".mat-mdc-select-value-text .mat-mdc-select-min-line"
      );
      const currentValue =
        currentValueEl?.textContent.trim().toLowerCase() || "";
      const targetValue = level.toLowerCase();
      if (currentValue === targetValue) return true;
      selectEl.click();
      await new Promise((r) => setTimeout(r, SHARED.TIMING.selectDropdown));
      const panelAppeared = await window.waitFor(
        () => {
          const panel = document.querySelector(
            'div[role="listbox"][aria-label="Thinking Level"]'
          );
          if (panel) {
            const options = panel.querySelectorAll('mat-option[role="option"]');
            return options.length > 0 ? { panel, options } : null;
          }
          return null;
        },
        3000,
        document.body
      );
      if (!panelAppeared) {
        document.body.click();
        return false;
      }
      for (const option of panelAppeared.options) {
        const primaryText = option.querySelector(
          ".mdc-list-item__primary-text"
        );
        if (primaryText?.textContent.trim().toLowerCase() === targetValue) {
          option.click();
          await new Promise((r) => setTimeout(r, SHARED.TIMING.panelAction));
          const newValueEl = selectEl.querySelector(
            ".mat-mdc-select-value-text .mat-mdc-select-min-line"
          );
          return newValueEl?.textContent.trim().toLowerCase() === targetValue;
        }
      }
      return false;
    } catch (err) {
      window.log(SHARED.LOG_LEVEL.ERROR, err.message, fn);
      document.body.click();
      return false;
    }
  };
  window.getButton = () => {
    const btn = document.querySelector(window.SEL.prompt.runButton);
    if (!btn) return null;
    const label =
      btn.querySelector(".label")?.textContent?.trim() ||
      btn.getAttribute("aria-label");
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
  window.waitButton = async (checkFn, label, timeout = 30000) => {
    const target = document.querySelector("ms-run-button") || document.body;
    return window.waitFor(
      () => {
        const state = window.getButton();
        return state && checkFn(state) ? state : null;
      },
      timeout,
      target
    );
  };
  window.waitFor = (checkFn, timeout = 30000, target = document.body) =>
    new Promise((resolve) => {
      const result = checkFn();
      if (result) return resolve(result);
      let timer, observer;
      const cleanup = (res) => {
        observer?.disconnect();
        clearTimeout(timer);
        resolve(res);
      };
      timer = setTimeout(() => cleanup(null), timeout);
      observer = new MutationObserver(() => {
        const res = checkFn();
        if (res) cleanup(res);
      });
      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "aria-label", "disabled"],
      });
    });
  window.Chat = {
    observer: null,
    active: false,
    count: 0,
    processing: false,
    queue: new Set(),
    async deleteOne(turn) {
      if (this.queue.has(turn)) return false;
      this.queue.add(turn);
      const fn = "Chat.deleteOne";
      const start = performance.now();
      try {
        const btn = turn.querySelector(window.SEL.chat.options);
        if (!btn) return false;
        btn.click();
        await new Promise((r) => setTimeout(r, SHARED.TIMING.optionsClick));
        const menu = await window.wait(
          'div[role="menu"].mat-mdc-menu-panel',
          1500
        );
        if (!menu) return false;
        const del = Array.from(
          menu.querySelectorAll('button[role="menuitem"]')
        ).find((b) => b.textContent.includes("Delete"));
        if (del) {
          del.click();
          await new Promise((r) => setTimeout(r, SHARED.TIMING.deleteClick));
          this.count++;
          window.log(SHARED.LOG_LEVEL.SUCCESS, `🗑️ #${this.count}`, fn, start);
          return true;
        }
      } catch (err) {
        window.log(SHARED.LOG_LEVEL.ERROR, err.message, fn, start);
      } finally {
        this.queue.delete(turn);
      }
      return false;
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
    async processExisting() {
      if (this.processing) return;
      this.processing = true;
      try {
        const turns = document.querySelectorAll(window.SEL.chat.turn);
        if (turns.length) await this.processNodes(turns);
      } finally {
        this.processing = false;
      }
    },
    async handleMutation(mutations) {
      if (!this.active || this.processing) return;
      for (const mut of mutations) {
        if (!this.active) break;
        await this.processNodes(mut.addedNodes);
      }
    },
    start() {
      if (this.active) return;
      this.active = true;
      this.count = 0;
      this.queue.clear();
      this.processExisting();
      this.observer = new MutationObserver(this.handleMutation.bind(this));
      this.observer.observe(document.querySelector("ms-app") || document.body, {
        childList: true,
        subtree: true,
      });
      UTILS.msg.toBackground(SHARED.MSG.AUTO_DELETE_STATUS, {
        active: true,
        count: 0,
      });
    },
    stop() {
      if (!this.active) return;
      this.observer?.disconnect();
      this.observer = null;
      this.active = false;
      this.processing = false;
      this.queue.clear();
      UTILS.msg.toBackground(SHARED.MSG.AUTO_DELETE_STATUS, {
        active: false,
        count: this.count,
      });
      this.count = 0;
    },
  };
  window.Audio = {
    ctx: null,
    osc: null,
    active: false,
    async start() {
      if (this.active) return { success: true, alreadyActive: true };
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === "suspended") await this.ctx.resume();
        this.osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        this.osc.frequency.value = (0.001 * 44100) / (2 * Math.PI);
        gain.gain.value = 0.0005;
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
      const usesLevel = SHARED.usesThinkingLevel(window.CONFIG.model);
      const stamp = usesLevel
        ? `${window.CONFIG.temperature}-${window.CONFIG.thinkingLevel}-${window.CONFIG.topP}`
        : `${window.CONFIG.temperature}-${window.CONFIG.thinkingBudget}-${window.CONFIG.topP}`;
      if (panel.getAttribute("data-settings-stamp") === stamp) return;
      if (!panel.querySelector(window.SEL.panel.content)) {
        await window.click(window.SEL.panel.open);
        await window.wait(window.SEL.panel.content, 2000, panel);
      }
      let changed = false;
      if (usesLevel) {
        changed =
          window.setInput(
            window.SEL.panel.temp,
            window.CONFIG.temperature,
            panel
          ) || changed;
        changed =
          (await window.setThinkingLevel(window.CONFIG.thinkingLevel, panel)) ||
          changed;
        changed =
          window.setInput(window.SEL.panel.topP, window.CONFIG.topP, panel) ||
          changed;
      } else {
        const budgetToggle = panel.querySelector(window.SEL.panel.budgetToggle);
        if (budgetToggle?.getAttribute("aria-checked") === "false") {
          budgetToggle.click();
          await new Promise((r) => setTimeout(r, SHARED.TIMING.panelAction));
        }
        changed =
          window.setInput(
            window.SEL.panel.temp,
            window.CONFIG.temperature,
            panel
          ) || changed;
        changed =
          window.setInput(
            window.SEL.panel.budget,
            window.CONFIG.thinkingBudget,
            panel
          ) || changed;
        changed =
          window.setInput(window.SEL.panel.topP, window.CONFIG.topP, panel) ||
          changed;
      }
      const searchToggle = panel.querySelector(window.SEL.panel.searchToggle);
      if (searchToggle?.getAttribute("aria-checked") === "true") {
        searchToggle.click();
        changed = true;
      }
      if (changed)
        await new Promise((r) => setTimeout(r, SHARED.TIMING.panelAction));
      panel.setAttribute("data-settings-stamp", stamp);
      await window.click(window.SEL.panel.close, panel, 100);
    },
    async send() {
      let state = window.getButton();
      if (!state?.button) throw new Error("Run button not found");
      if (state.isStop && window.CONFIG.autoStopRunning) {
        if (window.CONFIG.autoDeleteChats) window.Chat.stop();
        state.button.click();
        state = await window.waitButton((s) => s.isRun, "run", 30000);
        await new Promise((r) => setTimeout(r, SHARED.TIMING.stopProcess));
      }
      const textarea = await window.wait(window.SEL.prompt.textarea);
      if (!textarea) throw new Error("Textarea not found");
      textarea.value = "";
      textarea.focus();
      UTILS.dom.typeInput(textarea, window.CONFIG.prompt);
      state = await window.waitButton(
        (s) => s.isRun && s.enabled,
        "enabled",
        8000
      );
      if (!state) throw new Error("Button not enabled");
      state.button.click();
    },
  };
})();