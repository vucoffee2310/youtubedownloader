/* global SHARED, UTILS */

if (window.AStudioAutomatorLoaded) {
  console.log("⚠️ Content script already loaded");
} else {
  window.AStudioAutomatorLoaded = true;
  init();
}

function init() {
  // CONFIG - Only content-specific settings
  const CONFIG = {
    ...SHARED.DEFAULTS,
    autoDeleteChats: true,
    autoStopRunning: true,
    showProgress: true,
    logEveryNChunks: 5,
  };

  const SEL = {
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

  // LOGGING
  const COLORS = {
    [SHARED.LOG_LEVEL.SUCCESS]: "#2ecc71",
    [SHARED.LOG_LEVEL.ERROR]: "#e74c3c",
    [SHARED.LOG_LEVEL.INFO]: "#3498db",
    [SHARED.LOG_LEVEL.THINK]: "#9b59b6",
    [SHARED.LOG_LEVEL.STREAM]: "#1abc9c",
    [SHARED.LOG_LEVEL.NETWORK]: "#95a5a6",
    [SHARED.LOG_LEVEL.WARN]: "#f39c12",
  };

  const log = (level, msg, fn = null, start = null) => {
    const duration = start ? UTILS.time.elapsed(start).toFixed(2) : null;
    const meta = [fn && `[${fn}]`, duration && `⏱️${duration}ms`].filter(
      Boolean
    );
    console.log(
      `%c${meta.length ? `${meta.join(" ")} ${msg}` : msg}`,
      `color: ${COLORS[level] || "#999"}`
    );
    UTILS.msg.toBackground(SHARED.MSG.LOG, {
      level,
      message: msg,
      name: fn || "unknown",
      duration: duration ? parseFloat(duration) : null,
      timestamp: UTILS.time.iso(),
    });
  };

  const updateConfig = (settings) => {
    if (settings.prompt !== undefined) CONFIG.prompt = settings.prompt;
    if (settings.model !== undefined) CONFIG.model = settings.model;
    log(
      SHARED.LOG_LEVEL.SUCCESS,
      `Config updated: ${CONFIG.prompt.substring(0, 40)}...`,
      "updateConfig"
    );
  };

  // STATE - SPAM PROOF
  const State = {
    running: false,
    lockTime: null,
    lastComplete: null,
    lastAttempt: 0,
    rejectCount: 0,
    penaltyUntil: null,

    checkPenalty(now) {
      if (!this.penaltyUntil || now >= this.penaltyUntil) {
        if (this.penaltyUntil) {
          this.penaltyUntil = null;
          this.rejectCount = 0;
          log(
            SHARED.LOG_LEVEL.INFO,
            "✅ Penalty cleared",
            "State.checkPenalty"
          );
        }
        return false;
      }
      const remaining = Math.ceil((this.penaltyUntil - now) / 1000);
      log(
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
      const fn = "State.acquire",
        start = performance.now(),
        now = UTILS.time.now();
      if (this.checkPenalty(now)) return false;

      const timeSince = now - this.lastAttempt;
      if (timeSince < SHARED.TIMING.stateDebounce) {
        this.rejectCount++;
        log(
          SHARED.LOG_LEVEL.WARN,
          `⚠️ Too fast! Wait ${SHARED.TIMING.stateDebounce - timeSince}ms (${
            this.rejectCount
          }/${SHARED.LIMITS.maxRejects})`,
          fn,
          start
        );
        if (this.rejectCount >= SHARED.LIMITS.maxRejects) {
          this.penaltyUntil = now + SHARED.TIMING.statePenalty;
          log(
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
        log(
          SHARED.LOG_LEVEL.WARN,
          `⏳ Cooldown ${SHARED.TIMING.cooldown - (now - this.lastComplete)}ms`,
          fn,
          start
        );
        return false;
      }

      if (this.running) {
        const elapsed = now - this.lockTime;
        if (elapsed > SHARED.LIMITS.stateTimeout) {
          log(SHARED.LOG_LEVEL.WARN, `⚠️ Stale lock ${elapsed}ms`, fn, start);
          this.release();
        } else {
          log(SHARED.LOG_LEVEL.WARN, "⚠️ Already running", fn, start);
          return false;
        }
      }

      this.running = true;
      this.lockTime = now;
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
        running: true,
        locked: true,
      });
      log(SHARED.LOG_LEVEL.INFO, "🔒 Locked", fn, start);
      return true;
    },

    release() {
      this.running = false;
      this.lockTime = null;
      this.lastComplete = UTILS.time.now();
      UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
        running: false,
        locked: false,
      });
      log(SHARED.LOG_LEVEL.INFO, "🔓 Unlocked", "State.release");
    },
  };

  // UTILITIES
  const waitFor = (checkFn, timeout = 30000, target = document.body) =>
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

  const wait = (sel, timeout = 6000, scope = document) =>
    waitFor(() => scope.querySelector(sel), timeout, scope);

  const click = async (sel, scope = document, delay = SHARED.TIMING.click) => {
    const el = await wait(sel, 6000, scope);
    if (el) {
      el.click();
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    }
    return el;
  };

  const type = (el, text) => {
    el.value = text;
    ["input", "change", "blur"].forEach((evt) =>
      el.dispatchEvent(new Event(evt, { bubbles: true }))
    );
  };

  const setInput = (sel, val, scope = document) => {
    const input = scope
      .querySelector(sel)
      ?.querySelector('input[type="number"]');
    if (input && parseFloat(input.value) !== val) {
      type(input, val);
      input.focus();
      input.blur();
      return true;
    }
    return false;
  };

  // BUTTON STATE
  const getButton = () => {
    const btn = document.querySelector(SEL.prompt.runButton);
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

  const waitButton = async (checkFn, label, timeout = 30000) => {
    const fn = "waitButton",
      start = performance.now();
    const target = document.querySelector("ms-run-button") || document.body;
    const result = await waitFor(
      () => {
        const state = getButton();
        return state && checkFn(state) ? state : null;
      },
      timeout,
      target
    );
    log(
      result ? SHARED.LOG_LEVEL.SUCCESS : SHARED.LOG_LEVEL.ERROR,
      result ? `Button "${label}"` : `Timeout "${label}"`,
      fn,
      start
    );
    return result;
  };

  // CHAT DELETION - Simplified
  const Chat = {
    observer: null,
    active: false,
    count: 0,
    processing: false,
    queue: new Set(),

    async deleteOne(turn) {
      if (this.queue.has(turn)) return false;
      this.queue.add(turn);
      const fn = "Chat.deleteOne",
        start = performance.now();
      try {
        const btn = turn.querySelector(SEL.chat.options);
        if (!btn) return false;
        btn.click();
        await new Promise((r) => setTimeout(r, SHARED.TIMING.optionsClick));
        const menu = await wait('div[role="menu"].mat-mdc-menu-panel', 1500);
        if (!menu) return false;
        const del = Array.from(
          menu.querySelectorAll('button[role="menuitem"]')
        ).find((b) => b.textContent.includes("Delete"));
        if (del) {
          del.click();
          await new Promise((r) => setTimeout(r, SHARED.TIMING.deleteClick));
          this.count++;
          log(SHARED.LOG_LEVEL.SUCCESS, `🗑️ #${this.count}`, fn, start);
          return true;
        }
      } catch (err) {
        log(SHARED.LOG_LEVEL.ERROR, err.message, fn, start);
      } finally {
        this.queue.delete(turn);
      }
      return false;
    },

    async processNodes(nodes) {
      for (const node of nodes) {
        if (!this.active || node.nodeType !== Node.ELEMENT_NODE) break;
        if (node.matches?.(SEL.chat.turn)) await this.deleteOne(node);
        else {
          const turns = node.querySelectorAll?.(SEL.chat.turn) || [];
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
      const fn = "Chat.processExisting",
        start = performance.now();
      try {
        const turns = document.querySelectorAll(SEL.chat.turn);
        if (turns.length) {
          log(SHARED.LOG_LEVEL.INFO, `🔍 ${turns.length} chats`, fn);
          await this.processNodes(turns);
        }
        log(SHARED.LOG_LEVEL.SUCCESS, "Processed", fn, start);
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
      const fn = "Chat.start",
        start = performance.now();
      this.active = true;
      this.count = 0;
      this.queue.clear();
      log(SHARED.LOG_LEVEL.INFO, "👀 Active", fn, start);
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
      const fn = "Chat.stop",
        start = performance.now();
      this.observer?.disconnect();
      this.observer = null;
      this.active = false;
      this.processing = false;
      this.queue.clear();
      if (this.count)
        log(SHARED.LOG_LEVEL.SUCCESS, `🛑 Total: ${this.count}`, fn, start);
      UTILS.msg.toBackground(SHARED.MSG.AUTO_DELETE_STATUS, {
        active: false,
        count: this.count,
      });
      this.count = 0;
    },
  };

  // AUDIO
  const Audio = {
    ctx: null,
    osc: null,
    active: false,

    async start() {
      const fn = "Audio.start",
        start = performance.now();
      if (this.active) {
        log(SHARED.LOG_LEVEL.INFO, "🔊 Already active", fn, start);
        return { success: true, alreadyActive: true };
      }
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      this.osc.frequency.value = (0.001 * 44100) / (2 * Math.PI);
      gain.gain.value = 0.0005;
      this.osc.connect(gain).connect(this.ctx.destination);
      this.osc.start();
      this.active = true;
      log(SHARED.LOG_LEVEL.SUCCESS, "🔊 Started", fn, start);
      UTILS.msg.toBackground(SHARED.MSG.AUDIO_STATUS, { playing: true });
      return { success: true };
    },

    stop() {
      const fn = "Audio.stop",
        start = performance.now();
      this.osc?.stop();
      this.ctx?.close();
      this.osc = this.ctx = null;
      this.active = false;
      log(SHARED.LOG_LEVEL.SUCCESS, "🔇 Stopped", fn, start);
      UTILS.msg.toBackground(SHARED.MSG.AUDIO_STATUS, { playing: false });
      return { success: true };
    },
  };

  // AUTOMATION
  const Auto = {
    async run() {
      const fn = "Auto.run",
        start = performance.now();
      await wait("ms-app");
      log(SHARED.LOG_LEVEL.INFO, "🚀 Starting...", fn);
      await this.navbar();
      await this.panel();
      await this.send();
      log(SHARED.LOG_LEVEL.SUCCESS, "🎉 Complete", fn, start);
    },

    async navbar() {
      const fn = "Auto.navbar",
        start = performance.now();
      const nav = await wait(SEL.navbar.content);
      if (nav?.classList.contains("expanded")) {
        await click(SEL.navbar.toggle);
        log(SHARED.LOG_LEVEL.INFO, "📂 Closed", fn, start);
      } else log(SHARED.LOG_LEVEL.INFO, "📂 Already closed", fn, start);
    },

    async panel() {
      const fn = "Auto.panel",
        start = performance.now();
      const panel = await wait(SEL.panel.container);
      if (!panel) return log(SHARED.LOG_LEVEL.WARN, "⚠️ Not found", fn, start);

      const stamp = `${CONFIG.temperature}-${CONFIG.thinkingBudget}-${CONFIG.topP}`;
      if (panel.getAttribute("data-settings-stamp") === stamp)
        return log(SHARED.LOG_LEVEL.INFO, "✨ Cached", fn, start);

      if (!panel.querySelector(SEL.panel.content)) {
        await click(SEL.panel.open);
        await wait(SEL.panel.content, 2000, panel);
      }

      log(
        SHARED.LOG_LEVEL.INFO,
        `⚙️ T=${CONFIG.temperature} B=${CONFIG.thinkingBudget} P=${CONFIG.topP}`,
        fn
      );

      const budgetToggle = panel.querySelector(SEL.panel.budgetToggle);
      if (budgetToggle?.getAttribute("aria-checked") === "false") {
        budgetToggle.click();
        await new Promise((r) => setTimeout(r, SHARED.TIMING.panelAction));
      }

      let changed = false;
      changed = setInput(SEL.panel.temp, CONFIG.temperature, panel) || changed;
      changed =
        setInput(SEL.panel.budget, CONFIG.thinkingBudget, panel) || changed;
      changed = setInput(SEL.panel.topP, CONFIG.topP, panel) || changed;

      const searchToggle = panel.querySelector(SEL.panel.searchToggle);
      if (searchToggle?.getAttribute("aria-checked") === "true") {
        searchToggle.click();
        changed = true;
      }

      if (changed)
        await new Promise((r) => setTimeout(r, SHARED.TIMING.panelAction));
      panel.setAttribute("data-settings-stamp", stamp);
      await click(SEL.panel.close, panel, 100);
      log(SHARED.LOG_LEVEL.SUCCESS, "✅ Applied", fn, start);
    },

    async send() {
      const fn = "Auto.send",
        start = performance.now();
      let state = getButton();
      if (!state?.button) {
        log(SHARED.LOG_LEVEL.ERROR, "❌ Button not found", fn, start);
        throw new Error("Run button not found");
      }

      if (state.isStop && CONFIG.autoStopRunning) {
        log(SHARED.LOG_LEVEL.INFO, "⏸️ Stopping...", fn);
        if (CONFIG.autoDeleteChats) Chat.stop();
        state.button.click();
        state = await waitButton((s) => s.isRun, "run", 30000);
        await new Promise((r) => setTimeout(r, SHARED.TIMING.stopProcess));
        log(SHARED.LOG_LEVEL.SUCCESS, "Stopped", fn, performance.now());
      }

      const textarea = await wait(SEL.prompt.textarea);
      if (!textarea) {
        log(SHARED.LOG_LEVEL.ERROR, "❌ Textarea not found", fn, start);
        throw new Error("Textarea not found");
      }

      textarea.value = "";
      textarea.focus();
      type(textarea, CONFIG.prompt);
      log(
        SHARED.LOG_LEVEL.INFO,
        `📝 "${CONFIG.prompt.substring(0, 60)}..."`,
        fn
      );

      state = await waitButton((s) => s.isRun && s.enabled, "enabled", 8000);
      if (!state) {
        log(SHARED.LOG_LEVEL.ERROR, "❌ Not enabled", fn, start);
        throw new Error("Button not enabled");
      }

      state.button.click();
      log(SHARED.LOG_LEVEL.SUCCESS, "🚀 Sent", fn, start);
    },
  };

  // XHR INTERCEPTOR
  const injectXHR = () => {
    const fn = "injectXHR",
      start = performance.now();
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("interceptor.js");
    script.onload = () => {
      script.remove();
      log(SHARED.LOG_LEVEL.SUCCESS, "🔌 Injected", fn, start);
    };
    (document.head || document.documentElement).appendChild(script);
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "xhr-interceptor")
      return;
    const msg = event.data;

    // Always relay to background
    UTILS.msg.toBackground(SHARED.MSG.XHR_EVENT, {
      eventType: msg.type,
      data: msg,
    });

    // Enhanced logging
    const handlers = {
      "interceptor-ready": () => {
        log(SHARED.LOG_LEVEL.SUCCESS, "🎯 XHR Interceptor Ready", "XHR");
        console.log("✅ XHR Interceptor is active and listening");
      },

      "request-detected": () => {
        log(SHARED.LOG_LEVEL.NETWORK, `📡 ${msg.method} detected`, "XHR");
        console.log("🔍 XHR: Potential request detected");
      },

      request: () => {
        const promptPreview = msg.prompt?.substring(0, 60) || "unknown";
        log(
          SHARED.LOG_LEVEL.INFO,
          `📤 "${promptPreview}..." (${msg.promptLength}ch)`,
          "XHR.req"
        );
        log(SHARED.LOG_LEVEL.INFO, `⚙️ ${msg.model || "unknown"}`, "XHR.req");

        console.log("🚀 XHR: Request started", {
          prompt: promptPreview,
          length: msg.promptLength,
          autoDelete: CONFIG.autoDeleteChats,
        });

        if (CONFIG.autoDeleteChats) {
          console.log("🗑️ Starting auto-delete...");
          Chat.start();
        }
      },

      "thinking-update": () => {
        if (
          CONFIG.showProgress &&
          (msg.count === 1 || msg.count % CONFIG.logEveryNChunks === 0)
        ) {
          log(
            SHARED.LOG_LEVEL.THINK,
            `🤔 #${msg.count} | ${msg.totalLength}ch`,
            "XHR.think"
          );
        }
      },

      "streaming-update": () => {
        if (
          CONFIG.showProgress &&
          (msg.count === 1 || msg.count % CONFIG.logEveryNChunks === 0)
        ) {
          log(
            SHARED.LOG_LEVEL.STREAM,
            `✨ #${msg.count} | ${msg.totalLength}ch`,
            "XHR.stream"
          );
        }
      },

      complete: () => {
        const think = msg.thinking
          ? `${msg.thinkingCount}ch, ${msg.thinking.length}ch`
          : "none";
        const stream = msg.streaming
          ? `${msg.streamingCount}ch, ${msg.streaming.length}ch`
          : "none";
        log(
          SHARED.LOG_LEVEL.SUCCESS,
          `✅ ${msg.duration}ms | T:${think} S:${stream}`,
          "XHR.done"
        );

        console.log("✅ XHR: Request completed", {
          duration: msg.duration,
          thinking: msg.thinkingCount,
          streaming: msg.streamingCount,
        });

        if (CONFIG.autoDeleteChats) {
          console.log("🛑 Stopping auto-delete...");
          Chat.stop();
        }
      },

      error: () => {
        log(SHARED.LOG_LEVEL.ERROR, `❌ ${msg.message}`, "XHR.err");
        console.error("❌ XHR: Request error", msg.message);

        if (CONFIG.autoDeleteChats) {
          Chat.stop();
        }
      },
    };

    const handler = handlers[msg.type];
    if (handler) {
      handler();
    } else {
      console.warn("⚠️ Unknown XHR event type:", msg.type);
    }
  });

  // MESSAGE HANDLER
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    const handleAsync = (asyncFn) => {
      asyncFn()
        .then(respond)
        .catch((err) => {
          console.error("Handler error:", err);
          respond({ success: false, error: err.message });
          State.release();
        });
      return true;
    };

    const actions = {
      [SHARED.MSG.ACTION_PING]: () => respond({ success: true, pong: true }),
      [SHARED.MSG.ACTION_UPDATE_SETTINGS]: () => {
        if (!msg.settings)
          return respond({ success: false, error: "No settings provided" });
        updateConfig(msg.settings);
        respond({ success: true });
      },
      [SHARED.MSG.ACTION_START_AUDIO]: () => handleAsync(() => Audio.start()),
      [SHARED.MSG.ACTION_STOP_AUDIO]: () => respond(Audio.stop()),
      [SHARED.MSG.ACTION_RUN]: () => {
        const fn = "Msg.run",
          start = performance.now();
        if (msg.settings) updateConfig(msg.settings);
        if (!State.acquire()) {
          log(SHARED.LOG_LEVEL.WARN, "Rejected", fn, start);
          return respond({
            success: false,
            error: "Locked or cooldown",
            locked: true,
          });
        }
        respond({ success: true, status: "started" });
        Auto.run()
          .then(() => {
            log(SHARED.LOG_LEVEL.SUCCESS, "Done", fn, start);
            UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
              running: false,
              locked: false,
              completed: true,
            });
          })
          .catch((err) => {
            log(SHARED.LOG_LEVEL.ERROR, err.message, fn, start);
            UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, {
              running: false,
              locked: false,
              error: err.message,
            });
          })
          .finally(() => State.release());
        return true;
      },
      [SHARED.MSG.ACTION_STOP_AUTOMATION]: () => {
        const fn = "Msg.stop",
          start = performance.now();
        State.release();
        if (CONFIG.autoDeleteChats) Chat.stop();
        log(SHARED.LOG_LEVEL.INFO, "Manual stop", fn, start);
        respond({ success: true });
      },
    };

    const handler = actions[msg.action];
    if (!handler) {
      respond({ success: false, error: "Unknown action" });
      return false;
    }

    try {
      return handler() === true;
    } catch (err) {
      console.error("Handler error:", err);
      respond({ success: false, error: err.message });
      return false;
    }
  });

  // INIT
  setTimeout(() => {
    const fn = "init",
      start = performance.now();
    log(SHARED.LOG_LEVEL.SUCCESS, "✅ Ready", fn, start);
    log(SHARED.LOG_LEVEL.INFO, `📝 "${CONFIG.prompt.substring(0, 40)}..."`, fn);
    log(
      SHARED.LOG_LEVEL.INFO,
      `⚙️ T=${CONFIG.temperature} B=${CONFIG.thinkingBudget} P=${CONFIG.topP}`,
      fn
    );
    log(
      SHARED.LOG_LEVEL.INFO,
      `⏱️ Debounce:${SHARED.TIMING.stateDebounce}ms Cooldown:${SHARED.TIMING.cooldown}ms Penalty:${SHARED.TIMING.statePenalty}ms`,
      fn
    );
    UTILS.msg.toBackground(SHARED.MSG.CONTENT_READY);
    injectXHR();
  }, 500);
}
