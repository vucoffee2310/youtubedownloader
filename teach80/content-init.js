(function () {
  if (!window.AStudioAutomatorLoaded) {
    console.error("Content core not loaded");
    return;
  }

  // Inject XHR interceptor
  const injectXHR = () => {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("interceptor.js");
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  };

  // XHR event handlers
  const xhrHandlers = {
    [SHARED.MSG.XHR_READY]: () => {
      window.log(SHARED.LOG_LEVEL.SUCCESS, "🎯 XHR Ready", "XHR");
    },
    [SHARED.MSG.XHR_REQUEST]: msg => {
      window.log(SHARED.LOG_LEVEL.INFO, `📤 "${msg.prompt?.substring(0, 60)}..." (${msg.promptLength}ch)`, "XHR.req");
      if (window.CONFIG.autoDeleteChats) window.Chat.start();
    },
    [SHARED.MSG.XHR_THINKING]: msg => {
      if (window.CONFIG.showProgress && (msg.count === 1 || msg.count % window.CONFIG.logEveryNChunks === 0)) {
        window.log(SHARED.LOG_LEVEL.THINK, `🤔 #${msg.count} | ${msg.totalLength}ch`, "XHR.think");
      }
    },
    [SHARED.MSG.XHR_STREAMING]: msg => {
      if (window.CONFIG.showProgress && (msg.count === 1 || msg.count % window.CONFIG.logEveryNChunks === 0)) {
        window.log(SHARED.LOG_LEVEL.STREAM, `✨ #${msg.count} | ${msg.totalLength}ch`, "XHR.stream");
      }
    },
    [SHARED.MSG.XHR_COMPLETE]: msg => {
      const think = msg.thinking ? `${msg.thinkingCount}ch, ${msg.thinking.length}ch` : "none";
      const stream = msg.streaming ? `${msg.streamingCount}ch, ${msg.streaming.length}ch` : "none";
      window.log(SHARED.LOG_LEVEL.SUCCESS, `✅ ${msg.duration}ms | T:${think} S:${stream}`, "XHR.done");
      if (window.CONFIG.autoDeleteChats) window.Chat.stop();
    },
    [SHARED.MSG.XHR_ERROR]: msg => {
      window.log(SHARED.LOG_LEVEL.ERROR, `❌ ${msg.message}`, "XHR.err");
      if (window.CONFIG.autoDeleteChats) window.Chat.stop();
    },
  };

  // Listen for XHR events from interceptor
  window.addEventListener("message", event => {
    if (event.source !== window || event.data?.source !== "xhr-interceptor") return;
    const msg = event.data;
    UTILS.msg.toBackground(SHARED.MSG.XHR_EVENT, { eventType: msg.type, data: msg });
    xhrHandlers[msg.type]?.(msg);
  });

  // Message actions from dashboard
  const actions = {
    [SHARED.MSG.ACTION_PING]: () => ({ success: true, pong: true }),

    [SHARED.MSG.ACTION_START_AUDIO]: async () => await window.Audio.start(),

    [SHARED.MSG.ACTION_STOP_AUDIO]: () => window.Audio.stop(),

    [SHARED.MSG.ACTION_RUN]: (msg, respond) => {
      if (msg.settings) window.updateConfig(msg.settings);
      if (!window.State.acquire()) {
        return respond({ success: false, error: "Locked", locked: true });
      }
      respond({ success: true, status: "started" });

      window.Auto.run()
        .then(() => {
          UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, { running: false, locked: false, completed: true });
        })
        .catch(err => {
          window.log(SHARED.LOG_LEVEL.ERROR, err.message, "Auto.run");
          UTILS.msg.toBackground(SHARED.MSG.AUTOMATION_STATUS, { running: false, locked: false, error: err.message });
        })
        .finally(() => window.State.release());

      return true;
    },
  };

  // Message listener
  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    const handler = actions[msg.action];
    if (!handler) {
      respond({ success: false, error: "Unknown action" });
      return false;
    }

    try {
      const result = handler(msg, respond);
      if (result instanceof Promise) {
        result.then(respond).catch(err => {
          respond({ success: false, error: err.message });
          window.State.release();
        });
        return true;
      }
      if (result !== true && result !== undefined) respond(result);
      return result === true;
    } catch (err) {
      respond({ success: false, error: err.message });
      return false;
    }
  });

  // Initialize
  setTimeout(() => {
    UTILS.msg.toBackground(SHARED.MSG.CONTENT_READY);
    injectXHR();
  }, 500);
})();