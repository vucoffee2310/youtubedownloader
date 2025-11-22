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
        chrome.tabs.sendMessage(tabId, message, (response) => {
          callback?.(chrome.runtime.lastError ? null : response);
        });
      },
      toContent(tabId, action, data = {}) {
        return new Promise((resolve) => {
          this.toTab(tabId, { action, ...data }, resolve);
        });
      },
    },
    tab: {
      exists(tabId) {
        if (!chrome?.runtime?.id) return Promise.resolve(false);
        return new Promise((resolve) => {
          chrome.tabs.get(tabId, (tab) => {
            resolve(!chrome.runtime.lastError && !!tab);
          });
        });
      },
      focus(tabId) {
        if (!chrome?.runtime?.id || !tabId) return;
        chrome.tabs.update(tabId, { active: true }, (tab) => {
          if (!chrome.runtime.lastError && tab) {
            chrome.windows.update(tab.windowId, { focused: true });
          }
        });
      },
      create(url, active = true) {
        if (!chrome?.runtime?.id)
          throw new Error("Extension context unavailable");
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
      remove(key) {
        try {
          localStorage?.removeItem(key);
        } catch {}
      },
    },
    time: {
      now: () => Date.now(),
      elapsed: (start) => Date.now() - start,
      format: (timestamp) => new Date(timestamp).toLocaleTimeString(),
      iso: () => new Date().toISOString(),
    },
    validate: {
      tabId: (id) => typeof id === "number" && id > 0,
      message: (msg) => msg?.type,
    },
    dom: {
      wait(sel, timeout = 6000, scope = document) {
        return new Promise((resolve) => {
          const el = scope.querySelector(sel);
          if (el) return resolve(el);
          let timer, observer;
          const cleanup = (result) => {
            observer?.disconnect();
            clearTimeout(timer);
            resolve(result);
          };
          timer = setTimeout(() => cleanup(null), timeout);
          observer = new MutationObserver(() => {
            const found = scope.querySelector(sel);
            if (found) cleanup(found);
          });
          observer.observe(scope, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "aria-label", "disabled"],
          });
        });
      },
      click(el, delay = 150) {
        if (!el) return Promise.resolve(false);
        el.click();
        return delay > 0
          ? new Promise((r) => setTimeout(r, delay))
          : Promise.resolve(true);
      },
      typeInput(el, text) {
        if (!el) return;
        el.value = text;
        ["input", "change", "blur"].forEach((evt) =>
          el.dispatchEvent(new Event(evt, { bubbles: true }))
        );
      },
    },
    createSafeCallback(callback) {
      if (!callback) return null;
      let called = false;
      return (response) => {
        if (called) return;
        called = true;
        callback(response);
      };
    },
  };
  const target =
    typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
      ? window
      : global;
  target.UTILS = UTILS;
})(this);