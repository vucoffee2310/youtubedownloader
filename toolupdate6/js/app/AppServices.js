import { CONFIG } from "../config.js";
import { createButtonHandler } from "../utils.js";
export class ActionRegistry {
  #app;
  #actions;
  constructor(app) {
    this.#app = app;
    this.#actions = this.#defineActions();
  }
  #defineActions() {
    return {
      "expand-all-btn": () => this.#app.handleExpandAll(),
      "split-pdf-btn": () => this.#app.handleSplitPDF(),
      "save-print-btn": () => this.#app.handlePrint(),
      "save-direct-pdf-btn": () => this.#app.handleExportPDF(),
      "save-html-btn": () => this.#app.handleExportHTML(),
    };
  }
  attachButtons() {
    Object.entries(this.#actions).forEach(([buttonId, action]) => {
      const button = document.getElementById(buttonId);
      if (!button) return;
      button.addEventListener(
        "click",
        createButtonHandler(button, async () => {
          if (this.#app.checkOperationLock()) return;
          this.#app.setOperationLock(true);
          try {
            await action();
          } finally {
            this.#app.setOperationLock(false);
          }
        })
      );
    });
  }
  getAction(actionName) {
    return this.#actions[actionName];
  }
  hasAction(actionName) {
    return actionName in this.#actions;
  }
}
export class FileHandler {
  #app;
  constructor(app) {
    this.#app = app;
  }
  attachFileInputs() {
    const pdfInput = document.getElementById("file-input");
    const jsonInput = document.getElementById("json-input");
    if (pdfInput) {
      pdfInput.addEventListener("change", (e) => this.#handlePDFInput(e));
    }
    if (jsonInput) {
      jsonInput.addEventListener("change", (e) => this.#handleJSONInput(e));
    }
  }
  #handlePDFInput(event) {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    this.#app.handlePDFUpload(file);
  }
  #handleJSONInput(event) {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".json")) return;
    this.#app.handleJSONUpload(file);
  }
}
export class KeyboardShortcuts {
  #actionRegistry;
  #shortcuts;
  constructor(actionRegistry) {
    this.#actionRegistry = actionRegistry;
    this.#shortcuts = this.#defineShortcuts();
  }
  #defineShortcuts() {
    return {
      [CONFIG.KEYBOARD_SHORTCUTS.SPLIT]: "split-pdf-btn",
      [CONFIG.KEYBOARD_SHORTCUTS.EXPORT_PDF]: "save-direct-pdf-btn",
      [CONFIG.KEYBOARD_SHORTCUTS.PRINT]: "save-print-btn",
      [CONFIG.KEYBOARD_SHORTCUTS.EXPORT_HTML]: "save-html-btn",
    };
  }
  initialize() {
    document.addEventListener("keydown", (e) => this.#handleKeyPress(e));
  }
  #handleKeyPress(event) {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
    const key = event.key.toUpperCase();
    const buttonId = this.#shortcuts[key];
    if (!buttonId) return;
    if (this.#isTyping()) return;
    event.preventDefault();
    this.#triggerAction(buttonId);
  }
  #isTyping() {
    const activeElement = document.activeElement;
    return (
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable)
    );
  }
  #triggerAction(buttonId) {
    const button = document.getElementById(buttonId);
    if (button && !button.disabled) {
      button.click();
    }
  }
}
