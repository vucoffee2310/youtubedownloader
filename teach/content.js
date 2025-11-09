if (window.AStudioAutomatorLoaded) {
  console.log("⚠️ Content script already loaded");
} else {
  window.AStudioAutomatorLoaded = true;
  init();
}
function init() {
  // CONFIG
  let CONFIG = {
    prompt: "this is prompt",
    model: "gemini-2.0-flash-thinking-exp",
    temperature: 1.5,
    thinkingBudget: 500,
    topP: 0.5,
    autoDeleteChats: true,
    autoStopRunning: true,
    showProgress: true,
    logEveryNChunks: 5,
    timing: {
      click: 150,
      optionsClick: 200,
      deleteClick: 150,
      stopProcess: 400,
      panelAction: 250,
      cooldown: 1000,
    },
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
    success: "#2ecc71",
    error: "#e74c3c",
    info: "#3498db",
    think: "#9b59b6",
    stream: "#1abc9c",
    network: "#95a5a6",
    warn: "#f39c12",
  };
  const notify = (type, data = {}) =>
    chrome.runtime.sendMessage({ type, ...data }).catch(() => {});
  const log = (level, msg, fn = null, start = null) => {
    const duration = start ? (performance.now() - start).toFixed(2) : null;
    const meta = [];
    if (fn) meta.push(`[${fn}]`);
    if (duration) meta.push(`⏱️${duration}ms`);
    const fullMsg = meta.length ? `${meta.join(" ")} ${msg}` : msg;
    console.log(`%c${fullMsg}`, `color: ${COLORS[level] || "#999"}`);
    notify("LOG", {
      level,
      message: msg,
      name: fn || "unknown",
      duration: duration ? parseFloat(duration) : null,
      timestamp: new Date().toISOString(),
    });
  };
  const updateConfig = (settings) => {
    if (settings.prompt !== undefined) CONFIG.prompt = settings.prompt;
    if (settings.model !== undefined) CONFIG.model = settings.model;
    log(
      "success",
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
    TIMEOUT: 60000,
    DEBOUNCE: 800,
    MAX_REJECTS: 3,
    PENALTY_TIME: 3000,
    acquire() {
      const fn = "State.acquire",
        start = performance.now(),
        now = Date.now();
      if (this.penaltyUntil && now < this.penaltyUntil) {
        const remaining = Math.ceil((this.penaltyUntil - now) / 1000);
        log("error", `🚫 PENALTY! Wait ${remaining}s`, fn, start);
        notify("AUTOMATION_STATUS", {
          running: false,
          locked: true,
          penalty: true,
          remainingSeconds: remaining,
        });
        return false;
      }
      if (this.penaltyUntil && now >= this.penaltyUntil) {
        this.penaltyUntil = null;
        this.rejectCount = 0;
        log("info", "✅ Penalty cleared", fn, start);
      }
      const timeSinceLastAttempt = now - this.lastAttempt;
      if (timeSinceLastAttempt < this.DEBOUNCE) {
        this.rejectCount++;
        log(
          "warn",
          `⚠️ Too fast! Wait ${this.DEBOUNCE - timeSinceLastAttempt}ms (${
            this.rejectCount
          }/${this.MAX_REJECTS})`,
          fn,
          start
        );
        if (this.rejectCount >= this.MAX_REJECTS) {
          this.penaltyUntil = now + this.PENALTY_TIME;
          log(
            "error",
            `🚫 SPAM! ${this.PENALTY_TIME / 1000}s penalty`,
            fn,
            start
          );
          notify("AUTOMATION_STATUS", {
            running: false,
            locked: true,
            penalty: true,
            remainingSeconds: this.PENALTY_TIME / 1000,
          });
        }
        return false;
      }
      this.rejectCount = 0;
      this.lastAttempt = now;
      if (
        this.lastComplete &&
        now - this.lastComplete < CONFIG.timing.cooldown
      ) {
        log(
          "warn",
          `⏳ Cooldown ${CONFIG.timing.cooldown - (now - this.lastComplete)}ms`,
          fn,
          start
        );
        return false;
      }
      if (this.running) {
        const elapsed = now - this.lockTime;
        if (elapsed > this.TIMEOUT) {
          log("warn", `⚠️ Stale lock ${elapsed}ms`, fn, start);
          this.release();
        } else {
          log("warn", "⚠️ Already running", fn, start);
          return false;
        }
      }
      this.running = true;
      this.lockTime = now;
      notify("AUTOMATION_STATUS", { running: true, locked: true });
      log("info", "🔒 Locked", fn, start);
      return true;
    },
    release() {
      this.running = false;
      this.lockTime = null;
      this.lastComplete = Date.now();
      notify("AUTOMATION_STATUS", { running: false, locked: false });
      log("info", "🔓 Unlocked", "State.release");
    },
  };
  // UTILITIES
  const wait = (sel, timeout = 6000, scope = document) =>
    new Promise((resolve) => {
      const el = scope.querySelector(sel);
      if (el) return resolve(el);
      const start = Date.now();
      const interval = setInterval(() => {
        const el = scope.querySelector(sel);
        if (el || Date.now() - start > timeout) {
          clearInterval(interval);
          resolve(el);
        }
      }, 40);
    });
  const click = async (sel, scope = document, delay = CONFIG.timing.click) => {
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
  const waitFor = (checkFn, timeout = 30000, target = document.body) =>
    new Promise((resolve) => {
      const result = checkFn();
      if (result) return resolve(result);
      let timer, observer;
      const cleanup = (res) => {
        if (observer) observer.disconnect();
        if (timer) clearTimeout(timer);
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
  // BUTTON STATE
  const getButton = () => {
    const btn = document.querySelector(SEL.prompt.runButton);
    if (!btn) return null;
    const label = btn.querySelector(".label")?.textContent?.trim();
    const disabled = btn.disabled || btn.classList.contains("disabled");
    const stoppable = btn.classList.contains("stoppable");
    return {
      button: btn,
      label: label || btn.getAttribute("aria-label"),
      isStop: label === "Stop" || stoppable,
      isRun: label === "Run" && !stoppable,
      enabled: !disabled,
    };
  };
  const waitButton = async (targetState, timeout = 30000) => {
    const fn = "waitButton",
      start = performance.now();
    const target = document.querySelector("ms-run-button") || document.body;
    const result = await waitFor(
      () => {
        const state = getButton();
        if (!state) return null;
        if (targetState === "run" && state.isRun) return state;
        if (targetState === "stop" && state.isStop) return state;
        return null;
      },
      timeout,
      target
    );
    log(
      result ? "success" : "error",
      result ? `Button "${targetState}"` : `Timeout "${targetState}"`,
      fn,
      start
    );
    return result;
  };
  const waitEnabled = async (timeout = 8000) => {
    const fn = "waitEnabled",
      start = performance.now();
    log("info", "⏳ Waiting...", fn);
    const target = document.querySelector("ms-run-button") || document.body;
    const result = await waitFor(
      () => {
        const state = getButton();
        return state?.isRun && state.enabled ? state : null;
      },
      timeout,
      target
    );
    log(
      result ? "success" : "error",
      result ? "✅ Enabled" : "❌ Not enabled",
      fn,
      start
    );
    return result;
  };
  // CHAT DELETION
  const Chat = {
    observer: null,
    active: false,
    count: 0,
    processing: false,
    queue: new Set(),
    async deleteOne(turn) {
      const fn = "Chat.deleteOne",
        start = performance.now();
      if (this.queue.has(turn)) return false;
      this.queue.add(turn);
      try {
        const btn = turn.querySelector(SEL.chat.options);
        if (!btn) return false;
        btn.click();
        await new Promise((r) => setTimeout(r, CONFIG.timing.optionsClick));
        const menu = await wait('div[role="menu"].mat-mdc-menu-panel', 1500);
        if (!menu) return false;
        const del = Array.from(
          menu.querySelectorAll('button[role="menuitem"]')
        ).find((b) => b.textContent.includes("Delete"));
        if (del) {
          del.click();
          await new Promise((r) => setTimeout(r, CONFIG.timing.deleteClick));
          this.count++;
          log("success", `🗑️ #${this.count}`, fn, start);
          return true;
        }
      } catch (err) {
        log("error", err.message, fn, start);
      } finally {
        this.queue.delete(turn);
      }
      return false;
    },
    async processExisting() {
      if (this.processing) return;
      this.processing = true;
      const fn = "Chat.processExisting",
        start = performance.now();
      try {
        const turns = document.querySelectorAll(SEL.chat.turn);
        if (turns.length) {
          log("info", `🔍 ${turns.length} chats`, fn);
          for (const turn of turns) {
            if (!this.active) break;
            await this.deleteOne(turn);
          }
        }
        log("success", "Processed", fn, start);
      } finally {
        this.processing = false;
      }
    },
    async handleMutation(mutations) {
      if (!this.active || this.processing) return;
      for (const mut of mutations) {
        if (!this.active) break;
        for (const node of mut.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches?.(SEL.chat.turn)) {
            await this.deleteOne(node);
          } else if (node.querySelectorAll) {
            const turns = node.querySelectorAll(SEL.chat.turn);
            for (const turn of turns) {
              if (!this.active) break;
              await this.deleteOne(turn);
            }
          }
        }
      }
    },
    start() {
      if (this.active) return;
      const fn = "Chat.start",
        start = performance.now();
      this.active = true;
      this.count = 0;
      this.queue.clear();
      log("info", "👀 Active", fn, start);
      this.processExisting();
      this.observer = new MutationObserver(this.handleMutation.bind(this));
      this.observer.observe(document.querySelector("ms-app") || document.body, {
        childList: true,
        subtree: true,
      });
      notify("AUTO_DELETE_STATUS", { active: true, count: 0 });
    },
    stop() {
      if (!this.active) return;
      const fn = "Chat.stop",
        start = performance.now();
      if (this.observer) this.observer.disconnect();
      this.observer = null;
      this.active = false;
      this.processing = false;
      this.queue.clear();
      if (this.count) log("success", `🛑 Total: ${this.count}`, fn, start);
      notify("AUTO_DELETE_STATUS", { active: false, count: this.count });
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
        log("info", "🔊 Already active", fn, start);
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
      log("success", "🔊 Started", fn, start);
      notify("AUDIO_STATUS", { playing: true });
      return { success: true };
    },
    stop() {
      const fn = "Audio.stop",
        start = performance.now();
      if (this.osc) this.osc.stop();
      if (this.ctx) this.ctx.close();
      this.osc = this.ctx = null;
      this.active = false;
      log("success", "🔇 Stopped", fn, start);
      notify("AUDIO_STATUS", { playing: false });
      return { success: true };
    },
  };
  // AUTOMATION
  const Auto = {
    async run() {
      const fn = "Auto.run",
        start = performance.now();
      await wait("ms-app");
      log("info", "🚀 Starting...", fn);
      await this.navbar();
      await this.panel();
      await this.send();
      log("success", "🎉 Complete", fn, start);
    },
    async navbar() {
      const fn = "Auto.navbar",
        start = performance.now();
      const nav = await wait(SEL.navbar.content);
      if (nav?.classList.contains("expanded")) {
        await click(SEL.navbar.toggle);
        log("info", "📂 Closed", fn, start);
      } else {
        log("info", "📂 Already closed", fn, start);
      }
    },
    async panel() {
      const fn = "Auto.panel",
        start = performance.now();
      const panel = await wait(SEL.panel.container);
      if (!panel) {
        log("warn", "⚠️ Not found", fn, start);
        return;
      }
      const stamp = `${CONFIG.temperature}-${CONFIG.thinkingBudget}-${CONFIG.topP}`;
      if (panel.getAttribute("data-settings-stamp") === stamp) {
        log("info", "✨ Cached", fn, start);
        return;
      }
      if (!panel.querySelector(SEL.panel.content)) {
        await click(SEL.panel.open);
        await wait(SEL.panel.content, 2000, panel);
      }
      log(
        "info",
        `⚙️ T=${CONFIG.temperature} B=${CONFIG.thinkingBudget} P=${CONFIG.topP}`,
        fn
      );
      const budgetToggle = panel.querySelector(SEL.panel.budgetToggle);
      if (budgetToggle?.getAttribute("aria-checked") === "false") {
        budgetToggle.click();
        await new Promise((r) => setTimeout(r, CONFIG.timing.panelAction));
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
        await new Promise((r) => setTimeout(r, CONFIG.timing.panelAction));
      panel.setAttribute("data-settings-stamp", stamp);
      await click(SEL.panel.close, panel, 100);
      log("success", "✅ Applied", fn, start);
    },
    async send() {
      const fn = "Auto.send",
        start = performance.now();
      let state = getButton();
      if (!state?.button) {
        log("error", "❌ Button not found", fn, start);
        throw new Error("Run button not found");
      }
      if (state.isStop && CONFIG.autoStopRunning) {
        const stopStart = performance.now();
        log("info", "⏸️ Stopping...", fn);
        if (CONFIG.autoDeleteChats) Chat.stop();
        state.button.click();
        state = await waitButton("run", 30000);
        await new Promise((r) => setTimeout(r, CONFIG.timing.stopProcess));
        log("success", "Stopped", fn, stopStart);
      }
      const textarea = await wait(SEL.prompt.textarea);
      if (!textarea) {
        log("error", "❌ Textarea not found", fn, start);
        throw new Error("Textarea not found");
      }
      textarea.value = "";
      textarea.focus();
      type(textarea, CONFIG.prompt);
      log("info", `📝 "${CONFIG.prompt.substring(0, 60)}..."`, fn);
      state = await waitEnabled(8000);
      if (!state) {
        log("error", "❌ Not enabled", fn, start);
        throw new Error("Button not enabled");
      }
      state.button.click();
      log("success", "🚀 Sent", fn, start);
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
      log("success", "🔌 Injected", fn, start);
    };
    (document.head || document.documentElement).appendChild(script);
  };
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "xhr-interceptor")
      return;
    const msg = event.data;
    notify("XHR_EVENT", { eventType: msg.type, data: msg });
    const handlers = {
      "interceptor-ready": () => log("success", "🎯 Ready", "XHR"),
      "request-detected": () => log("network", `📡 ${msg.method}`, "XHR"),
      request: () => {
        log(
          "info",
          `📤 "${msg.prompt?.substring(0, 60)}..." (${msg.promptLength}ch)`,
          "XHR.req"
        );
        log("info", `⚙️ ${msg.model || "unknown"}`, "XHR.req");
        if (CONFIG.autoDeleteChats) Chat.start();
      },
      "thinking-update": () => {
        if (
          CONFIG.showProgress &&
          (msg.count === 1 || msg.count % CONFIG.logEveryNChunks === 0)
        ) {
          log("think", `🤔 #${msg.count} | ${msg.totalLength}ch`, "XHR.think");
        }
      },
      "streaming-update": () => {
        if (
          CONFIG.showProgress &&
          (msg.count === 1 || msg.count % CONFIG.logEveryNChunks === 0)
        ) {
          log(
            "stream",
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
          "success",
          `✅ ${msg.duration}ms | T:${think} S:${stream}`,
          "XHR.done"
        );
        if (CONFIG.autoDeleteChats) Chat.stop();
      },
      error: () => {
        log("error", `❌ ${msg.message}`, "XHR.err");
        if (CONFIG.autoDeleteChats) Chat.stop();
      },
    };
    handlers[msg.type]?.();
  });
  // MESSAGE HANDLER
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    const actions = {
      ping: () => {
        respond({ success: true, pong: true });
        return false;
      },
      updateSettings: () => {
        if (msg.settings) {
          updateConfig(msg.settings);
          respond({ success: true });
        } else {
          respond({ success: false, error: "No settings provided" });
        }
        return false;
      },
      startAudio: async () => {
        const result = await Audio.start();
        respond(result);
      },
      stopAudio: () => {
        const result = Audio.stop();
        respond(result);
        return false;
      },
      runAutomation: async () => {
        const fn = "Msg.run",
          start = performance.now();
        if (msg.settings) updateConfig(msg.settings);
        if (!State.acquire()) {
          log("warn", "Rejected", fn, start);
          respond({
            success: false,
            error: "Locked or cooldown",
            locked: true,
          });
          return;
        }
        respond({ success: true, status: "started" });
        Auto.run()
          .then(() => {
            log("success", "Done", fn, start);
            notify("AUTOMATION_STATUS", {
              running: false,
              locked: false,
              completed: true,
            });
          })
          .catch((err) => {
            log("error", err.message, fn, start);
            notify("AUTOMATION_STATUS", {
              running: false,
              locked: false,
              error: err.message,
            });
          })
          .finally(() => State.release());
      },
      stopAutomation: () => {
        const fn = "Msg.stop",
          start = performance.now();
        State.release();
        if (CONFIG.autoDeleteChats) Chat.stop();
        log("info", "Manual stop", fn, start);
        respond({ success: true });
        return false;
      },
    };
    const handler = actions[msg.action];
    if (!handler) {
      respond({ success: false, error: "Unknown action" });
      return false;
    }
    try {
      const result = handler();
      if (result instanceof Promise) {
        result.catch((err) => {
          console.error("Handler error:", err);
          State.release();
        });
        return true;
      }
      return result !== false;
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
    log("success", "✅ Ready", fn, start);
    log("info", `📝 "${CONFIG.prompt.substring(0, 40)}..."`, fn);
    log(
      "info",
      `⚙️ T=${CONFIG.temperature} B=${CONFIG.thinkingBudget} P=${CONFIG.topP}`,
      fn
    );
    log(
      "info",
      `⏱️ Debounce:${State.DEBOUNCE}ms Cooldown:${CONFIG.timing.cooldown}ms Penalty:${State.PENALTY_TIME}ms`,
      fn
    );
    notify("CONTENT_READY");
    injectXHR();
  }, 500);
}
