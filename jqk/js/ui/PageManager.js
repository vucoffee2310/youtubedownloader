import { createElementFromHTML } from "../utils.js";
import { CONFIG } from "../config.js";

const pageWrapperHTML = (pageNum, viewport) => `
  <div class="page-wrapper page-placeholder"
       id="page-wrapper-${pageNum}"
       data-page-num="${pageNum}"
       style="aspect-ratio: ${viewport.width} / ${viewport.height}">
    <span>Loading page ${pageNum}...</span>
    <div class="page-export-controls">
      <button class="page-export-btn"
              data-page="${pageNum}"
              title="Export page ${pageNum}">
        💾 Save Page ${pageNum}
      </button>
    </div>
  </div>
`;

export class PageManager {
  #container;
  constructor() {
    this.#container = document.querySelector("#pdf-container");
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
    const wrapper = createElementFromHTML(pageWrapperHTML(pageNum, viewport));
    wrapper.addEventListener("click", (e) => {
      if (e.target.classList.contains("page-export-btn")) {
        e.stopPropagation();
        this.#dispatchExportEvent(parseInt(e.target.dataset.page));
      }
    });
    this.#container?.appendChild(wrapper);
    return wrapper;
  }
  #dispatchExportEvent(pageNum) {
    document.dispatchEvent(
      new CustomEvent("exportSinglePage", {
        detail: { pageNum },
      })
    );
  }
}