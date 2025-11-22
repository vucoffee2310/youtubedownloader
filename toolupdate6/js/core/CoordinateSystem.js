import { CONFIG } from "../config.js";
import { createElementFromHTML, formatMessage } from "../utils.js";

class CoordinateValidator {
  #requiredLetters;
  constructor() {
    this.#requiredLetters = new Set(CONFIG.COORDINATES.LETTERS);
  }
  validate(order) {
    if (!order || typeof order !== "string") return false;
    if (order.length !== CONFIG.COORDINATES.LETTERS.length) return false;
    const chars = new Set(order.toUpperCase().split(""));
    if (chars.size !== CONFIG.COORDINATES.LETTERS.length) return false;
    return CONFIG.COORDINATES.LETTERS.every((letter) => chars.has(letter));
  }
  normalize(order) {
    return order.toUpperCase().trim();
  }
  isValidLetter(letter) {
    return this.#requiredLetters.has(letter.toUpperCase());
  }
  getRequiredLetters() {
    return [...this.#requiredLetters];
  }
  validateBbox(bbox) {
    if (!Array.isArray(bbox) || bbox.length !== 4) return false;
    const [top, left, bottom, right] = bbox;
    return (
      left < right &&
      top < bottom &&
      bbox.every((val) => typeof val === "number" && !isNaN(val))
    );
  }
}

export class CoordinateManager {
  #state;
  #validator;
  #currentOrder;
  #elements;
  constructor(stateManager) {
    this.#state = stateManager;
    this.#validator = new CoordinateValidator();
    this.#currentOrder = "";
    this.#elements = null;
  }
  initialize() {
    this.#cacheElements();
    this.#state.setGlobalCoordinateOrder(CONFIG.COORDINATES.DEFAULT_ORDER);
    this.#updateDisplay(CONFIG.COORDINATES.DEFAULT_ORDER);
    this.#attachEventListeners();
  }
  validateCoordinateOrder(order) {
    return this.#validator.validate(order);
  }
  normalizeCoordinateOrder(order) {
    return this.#validator.normalize(order);
  }
  #cacheElements() {
    this.#elements = {
      display: document.getElementById("coord-display"),
      buttons: document.querySelectorAll("#controls .coord-btn"),
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
    if (!this.#canAddCoordinate(letter)) return;
    this.#currentOrder += letter;
    this.#updateDisplay(this.#currentOrder);
    this.#markButtonUsed(letter);
    if (this.#currentOrder.length === CONFIG.COORDINATES.LETTERS.length) {
      setTimeout(() => this.#applyOrder(), CONFIG.UI.COORD_APPLY_DELAY);
    }
  }
  #canAddCoordinate(letter) {
    return (
      !this.#currentOrder.includes(letter) &&
      this.#currentOrder.length < CONFIG.COORDINATES.LETTERS.length
    );
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
      ? "var(--blue)"
      : "var(--gray-dark)";
  }
  async #applyOrder() {
    const order = this.#currentOrder.toUpperCase();
    if (!this.#validator.validate(order)) {
      this.#showError(CONFIG.MESSAGES.INVALID_COORDINATE);
      this.#reset();
      return;
    }
    try {
      this.#state.setGlobalCoordinateOrder(order);
      this.#dispatchOrderChange();
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
  #dispatchOrderChange() {
    document.dispatchEvent(new CustomEvent("coordinateOrderChanged"));
  }
  #showError(message) {
    document.dispatchEvent(
      new CustomEvent("coordinateError", {
        detail: { message },
      })
    );
  }
}
class CoordinateState {
  #pageNum;
  #currentOrder;
  #appliedOrder;
  #isOverride;
  #orderingIndex;
  #previewOrder;
  #originalOrder;
  constructor(pageNum, stateManager) {
    this.#pageNum = pageNum;
    this.#currentOrder = "";
    this.#appliedOrder = stateManager.getPageCoordinateOrder(pageNum);
    this.#isOverride = stateManager.pageOverrides.has(pageNum);
    this.#orderingIndex = 0;
    this.#previewOrder = null;
    this.#originalOrder = null;
  }
  addCoordinate(letter) {
    if (!this.canAddCoordinate(letter)) return false;
    this.#currentOrder += letter;
    return true;
  }
  canAddCoordinate(letter) {
    return (
      !this.#currentOrder.includes(letter) &&
      this.#currentOrder.length < CONFIG.COORDINATES.LETTERS.length
    );
  }
  isComplete() {
    return this.#currentOrder.length === CONFIG.COORDINATES.LETTERS.length;
  }
  getCurrentOrder() {
    return this.#currentOrder;
  }
  getAppliedOrder() {
    return this.#appliedOrder;
  }
  isOverride() {
    return this.#isOverride;
  }
  nextOrdering() {
    this.#orderingIndex =
      (this.#orderingIndex + 1) % CONFIG.COORDINATES.ORDERINGS.length;
    return CONFIG.COORDINATES.ORDERINGS[this.#orderingIndex];
  }
  startPreview(order, original) {
    this.#previewOrder = order;
    this.#originalOrder = original;
  }
  cancelPreview() {
    this.#previewOrder = null;
    this.#originalOrder = null;
  }
  isInPreview() {
    return this.#previewOrder !== null;
  }
  getPreviewOrder() {
    return this.#previewOrder;
  }
  getOriginalOrder() {
    return this.#originalOrder;
  }
  applyOrder(order) {
    this.#appliedOrder = order;
    this.#isOverride = true;
  }
  reset() {
    this.#currentOrder = "";
  }
  getData() {
    return {
      appliedOrder: this.#appliedOrder,
      isOverride: this.#isOverride,
    };
  }
}

class CoordinateControlTemplate {
  create(pageNum, state) {
    const displayClass = state.isOverride
      ? "coord-display overridden"
      : "coord-display";
    const html = `
      <div class="page-coord-controls">
        <button class="coord-cancel-btn" data-page="${pageNum}">×</button>
        <div class="coord-row">
          <span class="coord-row-label">P${pageNum}</span>
          <div class="${displayClass}" data-page="${pageNum}">${
      state.appliedOrder
    }</div>
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
          <div class="coord-buttons">
            ${this.#createCoordinateButtons(pageNum)}
          </div>
        </div>
      </div>
    `;
    return createElementFromHTML(html);
  }
  #createCoordinateButtons(pageNum) {
    return ["T", "L", "B", "R"]
      .map(
        (letter) => `
        <button class="coord-btn" data-coord="${letter}" data-page="${pageNum}">
          ${letter}
        </button>
      `
      )
      .join("");
  }
}

export class CoordinateControls {
  #coordManager;
  #pageStates;
  #template;
  constructor(coordManager) {
    this.#coordManager = coordManager;
    this.#pageStates = new Map();
    this.#template = new CoordinateControlTemplate();
  }
  addPageControls(wrapper, pageNum, stateManager, renderCallback) {
    const state = new CoordinateState(pageNum, stateManager);
    this.#pageStates.set(pageNum, state);
    const controls = this.#template.create(pageNum, state.getData());
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
    const state = this.#pageStates.get(pageNum);
    if (!state || !state.canAddCoordinate(letter)) return;
    state.addCoordinate(letter);
    this.#updateDisplay(pageNum, state.getCurrentOrder());
    this.#markButtonUsed(pageNum, letter);
    if (state.isComplete()) {
      setTimeout(
        () => this.#applyManualOrder(pageNum, stateManager, renderCallback),
        CONFIG.UI.COORD_APPLY_DELAY
      );
    }
  }
  #handleReload(pageNum, stateManager, renderCallback) {
    const state = this.#pageStates.get(pageNum);
    if (!state) return;
    const ordering = state.nextOrdering();
    state.startPreview(
      ordering.order,
      stateManager.getPageCoordinateOrder(pageNum)
    );
    this.#updatePreviewText(pageNum, ordering.name);
    this.#setPreviewMode(pageNum, true);
    stateManager.setPageCoordinateOrder(pageNum, ordering.order);
    renderCallback();
  }
  #handleCancel(pageNum, stateManager, renderCallback) {
    const state = this.#pageStates.get(pageNum);
    if (!state || !state.isInPreview()) return;
    const originalOrder = state.getOriginalOrder();
    if (originalOrder) {
      stateManager.setPageCoordinateOrder(pageNum, originalOrder);
    }
    state.cancelPreview();
    this.#setPreviewMode(pageNum, false);
    renderCallback();
  }
  #handleApply(action, pageNum, stateManager, renderCallback) {
    const state = this.#pageStates.get(pageNum);
    if (!state || !state.isInPreview()) return;
    const previewOrder = state.getPreviewOrder();
    if (action === "current") {
      this.#applyToCurrentPage(pageNum, previewOrder, stateManager, state);
      this.#setPreviewMode(pageNum, false);
      renderCallback();
    } else if (action === "all") {
      this.#applyToAllPages(previewOrder, stateManager, state);
    }
  }
  #applyManualOrder(pageNum, stateManager, renderCallback) {
    const state = this.#pageStates.get(pageNum);
    if (!state) return;
    const order = state.getCurrentOrder();
    if (!this.#coordManager.validateCoordinateOrder(order)) {
      alert(CONFIG.MESSAGES.INVALID_COORDINATE);
      this.#resetManualInput(pageNum);
      return;
    }
    const normalized = this.#coordManager.normalizeCoordinateOrder(order);
    stateManager.setPageCoordinateOrder(pageNum, normalized);
    state.applyOrder(normalized);
    this.#updateOverrideDisplay(pageNum, normalized);
    this.#resetManualInput(pageNum);
    renderCallback();
  }
  #applyToCurrentPage(pageNum, order, stateManager, state) {
    stateManager.setPageCoordinateOrder(pageNum, order);
    state.applyOrder(order);
    state.cancelPreview();
    this.#updateOverrideDisplay(pageNum, order);
  }
  #applyToAllPages(order, stateManager) {
    const message = formatMessage(CONFIG.MESSAGES.APPLY_ALL_CONFIRM, { order });
    if (!confirm(message)) return;
    stateManager.applyCoordinateOrderToAllPages(order);
    stateManager.setGlobalCoordinateOrder(order);
    document.getElementById("coord-display").textContent = order;
    this.#pageStates.forEach((pageState, pageNum) => {
      pageState.applyOrder(order);
      pageState.cancelPreview();
      this.#updateOverrideDisplay(pageNum, order);
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
    const state = this.#pageStates.get(pageNum);
    if (state) {
      state.reset();
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
