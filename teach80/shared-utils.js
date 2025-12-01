(function (global) {
  "use strict";
  const UTILS = {
    msg: {
      toBackground(type, data = {}) {
        if (!chrome?.runtime?.id) return Promise.resolve(null);
        return chrome.runtime.sendMessage({ type, ...data }).catch(() => null);
      },
      toTab(tabId, message, callback) {
        if (!chrome?.runtime?.id || !tabId) return callback?.(null);
        chrome.tabs.sendMessage(tabId, message, response => {
          callback?.(chrome.runtime.lastError ? null : response);
        });
      },
      toContent(tabId, action, data = {}) {
        return new Promise(resolve => this.toTab(tabId, { action, ...data }, resolve));
      },
    },
    tab: {
      exists(tabId) {
        if (!chrome?.runtime?.id) return Promise.resolve(false);
        return new Promise(resolve => {
          chrome.tabs.get(tabId, tab => resolve(!chrome.runtime.lastError && !!tab));
        });
      },
      focus(tabId) {
        if (!chrome?.runtime?.id || !tabId) return;
        chrome.tabs.update(tabId, { active: true }, tab => {
          if (!chrome.runtime.lastError && tab) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      },
      create(url, active = true) {
        if (!chrome?.runtime?.id) throw new Error("Extension context unavailable");
        return chrome.tabs.create({ url, active });
      },
    },
    storage: {
      get(key, defaultValue = null) {
        if (typeof localStorage === "undefined") return defaultValue;
        try {
          const value = localStorage.getItem(key);
          return value ? JSON.parse(value) : defaultValue;
        } catch {
          return defaultValue;
        }
      },
      set(key, value) {
        if (typeof localStorage === "undefined") return false;
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      },
    },
    time: {
      now: () => Date.now(),
      format: ts => new Date(ts).toLocaleTimeString(),
      iso: () => new Date().toISOString(),
    },
    validate: {
      tabId: id => typeof id === "number" && id > 0,
    },
    dom: {
      wait(selectorOrFn, timeout = 6000, scope = document, watchAttributes = false) {
        return new Promise(resolve => {
          const check = typeof selectorOrFn === "function" ? selectorOrFn : () => scope.querySelector(selectorOrFn);
          const result = check();
          if (result) return resolve(result);

          let timer, observer;
          const cleanup = res => {
            observer?.disconnect();
            clearTimeout(timer);
            resolve(res);
          };

          timer = setTimeout(() => cleanup(null), timeout);
          observer = new MutationObserver(() => {
            const found = check();
            if (found) cleanup(found);
          });

          const config = { childList: true, subtree: true };
          if (watchAttributes) {
            config.attributes = true;
            config.attributeFilter = ["class", "aria-label", "disabled"];
          }
          observer.observe(scope === document ? document.body : scope, config);
        });
      },
      click(el, delay = 150) {
        if (!el) return Promise.resolve(false);
        el.click();
        return delay > 0 ? new Promise(r => setTimeout(r, delay)) : Promise.resolve(true);
      },
      typeInput(el, text) {
        if (!el) return;
        el.value = text;
        ["input", "change", "blur"].forEach(evt => el.dispatchEvent(new Event(evt, { bubbles: true })));
      },
    },
  };
  (typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global).UTILS = UTILS;
})(this);