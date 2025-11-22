import { createElementFromHTML } from "../utils.js";
import { CONFIG } from "../config.js";

class PageTemplate {
  createWrapper(pageNum, viewport) {
    const html = `
      <div class="page-wrapper page-placeholder"
           id="page-wrapper-${pageNum}"
           data-page-num="${pageNum}"
           style="aspect-ratio: ${viewport.width} / ${viewport.height}">
        <span>Loading page ${pageNum}...</span>
        ${this.#createExportControls(pageNum)}
      </div>
    `;
    return createElementFromHTML(html);
  }
  createSavingIndicator(message) {
    const html = `
      <div class="saving-indicator active">
        <div class="saving-content">
          <div class="saving-spinner"></div>
          <div class="saving-message">${message}</div>
        </div>
      </div>
    `;
    return createElementFromHTML(html);
  }
  #createExportControls(pageNum) {
    return `
      <div class="page-export-controls">
        <button class="page-export-btn"
                data-page="${pageNum}"
                title="Export page ${pageNum}">
          💾 Save Page ${pageNum}
        </button>
      </div>
    `;
  }
}

export class PageManager {
  #container;
  #template;
  constructor() {
    this.#container = document.querySelector("#pdf-container");
    this.#template = new PageTemplate();
  }
  showLoading(message) {
    if (this.#container) {
      this.#container.innerHTML = `<div class="loading">${message}</div>`;
    }
  }
  updatePageInfo(message) {
    const element = document.getElementById("page-info");
    if (element) {
      element.textContent = message;
    }
  }
  updateFileName(element, name, defaultText) {
    if (element) {
      element.textContent = name || defaultText;
    }
  }
  clearContainer() {
    if (this.#container) {
      this.#container.innerHTML = "";
    }
  }
  createPageWrapper(pageNum, viewport) {
    const wrapper = this.#template.createWrapper(pageNum, viewport);
    wrapper.addEventListener("click", (e) => {
      if (e.target.classList.contains("page-export-btn")) {
        e.stopPropagation();
        this.#dispatchExportEvent(parseInt(e.target.dataset.page));
      }
    });
    this.#container?.appendChild(wrapper);
    return wrapper;
  }
  showSavingIndicator(message = "Processing...") {
    const indicator = this.#template.createSavingIndicator(message);
    document.body.appendChild(indicator);
    indicator.offsetHeight;
    return indicator;
  }
  removeSavingIndicator(indicator) {
    if (!indicator) return;
    indicator.classList.remove("active");
    setTimeout(() => indicator.remove(), CONFIG.UI.SAVING_INDICATOR_HIDE_DELAY);
  }
  #dispatchExportEvent(pageNum) {
    document.dispatchEvent(
      new CustomEvent("exportSinglePage", {
        detail: { pageNum },
      })
    );
  }
}
