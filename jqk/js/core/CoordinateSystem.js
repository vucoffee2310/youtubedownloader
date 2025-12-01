import { CONFIG } from "../config.js";
import { createElementFromHTML, formatMessage } from "../utils.js";

export const validateCoordOrder = (order) => {
  if (!order || typeof order !== "string") return false;
  if (order.length !== CONFIG.COORDINATES.LETTERS.length) return false;
  const chars = new Set(order.toUpperCase().split(""));
  if (chars.size !== CONFIG.COORDINATES.LETTERS.length) return false;
  return CONFIG.COORDINATES.LETTERS.every((letter) => chars.has(letter));
};

const createCoordControlsHTML = (pageNum, appliedOrder, isOverride) => {
  const displayClass = isOverride
    ? "coord-display overridden"
    : "coord-display";

  const buttons = ["T", "L", "B", "R"]
    .map(
      (letter) => `
        <button class="coord-btn" data-coord="${letter}" data-page="${pageNum}">
          ${letter}
        </button>
      `
    )
    .join("");

  return `
    <div class="page-coord-controls">
      <button class="coord-cancel-btn" data-page="${pageNum}">×</button>
      <div class="coord-row">
        <span class="coord-row-label">P${pageNum}</span>
        <div class="${displayClass}" data-page="${pageNum}">${appliedOrder}</div>
        <button class="coord-reload-btn" data-page="${pageNum}">↻</button>
      </div>
      <div class="coord-preview-text" data-page="${pageNum}"></div>
      <div class="coord-action-row">
        <button class="coord-action-btn primary" data-page="${pageNum}" data-action="current">
          Apply
        </button>
        <button class="coord-action-btn" data-page="${pageNum}" data-action="all">
          All Pages
        </button>
      </div>
      <div class="coord-row">
        <span class="coord-row-label">Manual</span>
        <div class="coord-buttons">${buttons}</div>
      </div>
    </div>
  `;
};

export class CoordinateManager {
  #state;
  #currentOrder;
  #elements;

  constructor(stateManager) {
    this.#state = stateManager;
    this.#currentOrder = "";
    this.#elements = null;
  }

  initialize() {
    this.#cacheElements();
    this.#state.setGlobalCoordinateOrder(CONFIG.COORDINATES.DEFAULT_ORDER);
    this.#updateDisplay(CONFIG.COORDINATES.DEFAULT_ORDER);
    this.#attachEventListeners();
  }

  #cacheElements() {
    this.#elements = {
      display: document.getElementById("coord-display"),
      buttons: document.querySelectorAll("#controls .btn-coord"),
    };
  }

  #attachEventListeners() {
    this.#elements.buttons?.forEach((btn) =>
      btn.addEventListener("click", () =>
        this.#handleCoordinateClick(btn.dataset.coord)
      )
    );
  }

  #handleCoordinateClick(letter) {
    if (
      this.#currentOrder.includes(letter) ||
      this.#currentOrder.length >= CONFIG.COORDINATES.LETTERS.length
    ) {
      return;
    }

    this.#currentOrder += letter;
    this.#updateDisplay(this.#currentOrder);
    this.#markButtonUsed(letter);

    if (this.#currentOrder.length === CONFIG.COORDINATES.LETTERS.length) {
      setTimeout(() => this.#applyOrder(), CONFIG.UI.COORD_APPLY_DELAY);
    }
  }

  #markButtonUsed(letter) {
    this.#elements.buttons.forEach((btn) => {
      if (btn.dataset.coord === letter) {
        btn.classList.add("used");
      }
    });
  }

  #updateDisplay(order) {
    if (!this.#elements.display) return;

    const displayText = order || "____";
    const isComplete = order.length === CONFIG.COORDINATES.LETTERS.length;

    this.#elements.display.textContent = displayText;
    this.#elements.display.style.borderColor = isComplete
      ? "var(--accent-color)"
      : "var(--border-subtle)";
  }

  async #applyOrder() {
    const order = this.#currentOrder.toUpperCase();

    if (!validateCoordOrder(order)) {
      this.#showError(CONFIG.MESSAGES.INVALID_COORDINATE);
      this.#reset();
      return;
    }

    try {
      this.#state.setGlobalCoordinateOrder(order);
      document.dispatchEvent(new CustomEvent("coordinateOrderChanged"));
      this.#reset();
      this.#updateDisplay(order);
    } catch (error) {
      this.#showError(`Invalid coordinate order: ${error.message}`);
      this.#reset();
    }
  }

  #reset() {
    this.#currentOrder = "";
    this.#elements.buttons?.forEach((btn) => btn.classList.remove("used"));
  }

  #showError(message) {
    document.dispatchEvent(
      new CustomEvent("coordinateError", { detail: { message } })
    );
  }
}

export class CoordinateControls {
  #coordManager;
  #uiState;

  constructor(coordManager) {
    this.#coordManager = coordManager;
    this.#uiState = new Map();
  }

  addPageControls(wrapper, pageNum, stateManager, renderCallback) {
    this.#uiState.set(pageNum, {
      currentOrder: "",
      orderingIndex: 0,
      previewOrder: null,
      originalOrder: null,
    });

    const appliedOrder = stateManager.getPageCoordinateOrder(pageNum);
    const isOverride = stateManager.pageOverrides.has(Number(pageNum));

    const html = createCoordControlsHTML(pageNum, appliedOrder, isOverride);
    const controls = createElementFromHTML(html);

    this.#attachEventHandlers(controls, pageNum, stateManager, renderCallback);

    wrapper.appendChild(controls);
  }

  #attachEventHandlers(controls, pageNum, stateManager, renderCallback) {
    controls.addEventListener("click", (e) => {
      const { target } = e;

      if (target.classList.contains("coord-btn")) {
        this.#handleManualInput(
          target.dataset.coord,
          pageNum,
          stateManager,
          renderCallback
        );
      } else if (target.classList.contains("coord-reload-btn")) {
        this.#handleReload(pageNum, stateManager, renderCallback);
      } else if (target.classList.contains("coord-cancel-btn")) {
        this.#handleCancel(pageNum, stateManager, renderCallback);
      } else if (target.classList.contains("coord-action-btn")) {
        this.#handleApply(
          target.dataset.action,
          pageNum,
          stateManager,
          renderCallback
        );
      }
    });
  }

  #handleManualInput(letter, pageNum, stateManager, renderCallback) {
    const ui = this.#uiState.get(pageNum);
    if (!ui) return;

    if (
      ui.currentOrder.includes(letter) ||
      ui.currentOrder.length >= CONFIG.COORDINATES.LETTERS.length
    ) {
      return;
    }

    ui.currentOrder += letter;
    this.#updateDisplay(pageNum, ui.currentOrder);
    this.#markButtonUsed(pageNum, letter);

    if (ui.currentOrder.length === CONFIG.COORDINATES.LETTERS.length) {
      setTimeout(
        () => this.#applyManualOrder(pageNum, stateManager, renderCallback),
        CONFIG.UI.COORD_APPLY_DELAY
      );
    }
  }

  #handleReload(pageNum, stateManager, renderCallback) {
    const ui = this.#uiState.get(pageNum);
    if (!ui) return;

    ui.orderingIndex =
      (ui.orderingIndex + 1) % CONFIG.COORDINATES.ORDERINGS.length;
    const ordering = CONFIG.COORDINATES.ORDERINGS[ui.orderingIndex];

    ui.previewOrder = ordering.order;
    ui.originalOrder = stateManager.getPageCoordinateOrder(pageNum);

    this.#updatePreviewText(pageNum, ordering.name);
    this.#setPreviewMode(pageNum, true);

    stateManager.setPageCoordinateOrder(pageNum, ordering.order);
    renderCallback();
  }

  #handleCancel(pageNum, stateManager, renderCallback) {
    const ui = this.#uiState.get(pageNum);
    if (!ui || ui.previewOrder === null) return;

    if (ui.originalOrder) {
      stateManager.setPageCoordinateOrder(pageNum, ui.originalOrder);
    }

    ui.previewOrder = null;
    ui.originalOrder = null;

    this.#setPreviewMode(pageNum, false);
    renderCallback();
  }

  #handleApply(action, pageNum, stateManager, renderCallback) {
    const ui = this.#uiState.get(pageNum);
    if (!ui || ui.previewOrder === null) return;

    if (action === "current") {
      stateManager.setPageCoordinateOrder(pageNum, ui.previewOrder);
      ui.previewOrder = null;
      ui.originalOrder = null;

      const appliedOrder = stateManager.getPageCoordinateOrder(pageNum);
      this.#updateOverrideDisplay(pageNum, appliedOrder);

      this.#setPreviewMode(pageNum, false);
      renderCallback();
    } else if (action === "all") {
      this.#applyToAllPages(ui.previewOrder, stateManager);
    }
  }

  #applyManualOrder(pageNum, stateManager, renderCallback) {
    const ui = this.#uiState.get(pageNum);
    if (!ui) return;

    const order = ui.currentOrder;

    if (!validateCoordOrder(order)) {
      alert(CONFIG.MESSAGES.INVALID_COORDINATE);
      this.#resetManualInput(pageNum);
      return;
    }

    const normalized = order.toUpperCase().trim();
    stateManager.setPageCoordinateOrder(pageNum, normalized);

    const appliedOrder = stateManager.getPageCoordinateOrder(pageNum);
    this.#updateOverrideDisplay(pageNum, appliedOrder);

    this.#resetManualInput(pageNum);
    renderCallback();
  }

  #applyToAllPages(order, stateManager) {
    const message = formatMessage(CONFIG.MESSAGES.APPLY_ALL_CONFIRM, { order });
    if (!confirm(message)) return;

    stateManager.applyCoordinateOrderToAllPages(order);
    stateManager.setGlobalCoordinateOrder(order);

    const globalDisplay = document.getElementById("coord-display");
    if (globalDisplay) {
      globalDisplay.textContent = order;
    }

    this.#uiState.forEach((ui, pageNum) => {
      ui.previewOrder = null;
      ui.originalOrder = null;

      const appliedOrder = stateManager.getPageCoordinateOrder(pageNum);
      this.#updateOverrideDisplay(pageNum, appliedOrder);
      this.#setPreviewMode(pageNum, false);
    });

    document.dispatchEvent(new CustomEvent("reloadAllPages"));
  }

  #updateDisplay(pageNum, order) {
    const display = document.querySelector(
      `.coord-display[data-page="${pageNum}"]`
    );
    if (display) {
      display.textContent = order || "____";
    }
  }

  #updateOverrideDisplay(pageNum, order) {
    const display = document.querySelector(
      `.coord-display[data-page="${pageNum}"]`
    );
    if (display) {
      display.textContent = order;
      display.classList.add("overridden");
    }
  }

  #updatePreviewText(pageNum, text) {
    const previewText = document.querySelector(
      `.coord-preview-text[data-page="${pageNum}"]`
    );
    if (previewText) {
      previewText.textContent = text;
    }
  }

  #markButtonUsed(pageNum, letter) {
    const button = document.querySelector(
      `.coord-btn[data-coord="${letter}"][data-page="${pageNum}"]`
    );
    if (button) {
      button.classList.add("used");
    }
  }

  #resetManualInput(pageNum) {
    const ui = this.#uiState.get(pageNum);
    if (ui) {
      ui.currentOrder = "";
    }

    document
      .querySelectorAll(`.coord-btn[data-page="${pageNum}"]`)
      .forEach((btn) => btn.classList.remove("used"));
  }

  #setPreviewMode(pageNum, active) {
    const controls = document.querySelector(
      `#page-wrapper-${pageNum} .page-coord-controls`
    );
    const wrapper = document.querySelector(`#page-wrapper-${pageNum}`);

    if (controls) {
      controls.classList.toggle("preview-active", active);
    }
    if (wrapper) {
      wrapper.classList.toggle("preview-mode", active);
    }
  }
}