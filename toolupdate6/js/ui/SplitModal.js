import {
  parsePageSpec,
  formatPageList,
  validateRange,
  formatMessage,
} from "../utils.js";
import { CONFIG } from "../config.js";

class SplitOptionsValidator {
  validate(mode, values) {
    const validators = {
      all: () => ({ valid: true }),
      "by-files": () => this.#validateNumberOfFiles(values.numFiles),
      "by-pages": () => this.#validatePagesPerFile(values.pagesPerFile),
      range: () => this.#validateRange(values.rangeStart, values.rangeEnd),
      custom: () => this.#validateCustomPages(values.customPages),
    };
    return validators[mode]?.() || { valid: false, error: "Unknown mode" };
  }
  #validateNumberOfFiles(numFiles) {
    if (!numFiles || numFiles < 2) {
      return { valid: false, error: "Number of files must be at least 2" };
    }
    return { valid: true };
  }
  #validatePagesPerFile(pagesPerFile) {
    if (!pagesPerFile || pagesPerFile < 1) {
      return { valid: false, error: "Pages per file must be at least 1" };
    }
    return { valid: true };
  }
  #validateRange(start, end) {
    const totalPages = document.querySelectorAll(".page-wrapper").length;
    return validateRange(start, end, totalPages);
  }
  #validateCustomPages(customPages) {
    if (!customPages || !customPages.trim()) {
      return { valid: false, error: "Please enter page numbers" };
    }
    const totalPages = document.querySelectorAll(".page-wrapper").length;
    const pages = parsePageSpec(customPages, totalPages);
    if (!pages.length) {
      return { valid: false, error: CONFIG.MESSAGES.INVALID_PAGE_SPEC };
    }
    return { valid: true };
  }
}

export class SplitModal {
  #pdfExporter;
  #pdfHandler;
  #pageManager;
  #validator;
  #pdfName;
  #modal;
  constructor(pdfExporter, pdfHandler, pageManager) {
    this.#pdfExporter = pdfExporter;
    this.#pdfHandler = pdfHandler;
    this.#pageManager = pageManager;
    this.#validator = new SplitOptionsValidator();
    this.#pdfName = "";
    this.#modal = document.getElementById("split-modal");
    this.#initialize();
  }
  show(pdfName) {
    this.#pdfName = pdfName;
    const totalPages = this.#pdfHandler.getNumPages();
    this.#updateModalInfo(totalPages);
    this.updateEstimate();
    this.#modal?.classList.add("active");
  }
  hide() {
    this.#modal?.classList.remove("active");
  }
  updateEstimate() {
    const mode = this.#getSelectedMode();
    const totalPages = this.#pdfHandler.getNumPages();
    const estimate = this.#calculateEstimate(mode, totalPages);
    const estimateElement = document.getElementById("modal-estimate");
    if (estimateElement) {
      estimateElement.textContent = estimate;
    }
  }
  async handleExport() {
    const mode = this.#getSelectedMode();
    if (!mode) {
      alert("Please select a split mode");
      return;
    }
    const validation = this.#validator.validate(mode, this.#getInputValues());
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    this.hide();
    const exportActions = {
      all: () => this.#pdfExporter.splitPDF(this.#pdfName, this.#pageManager),
      "by-files": () => this.#exportByFiles(),
      "by-pages": () => this.#exportByPages(),
      range: () => this.#exportRange(),
      custom: () => this.#exportCustom(),
    };
    try {
      await exportActions[mode]?.();
    } catch (error) {
      console.error("Export error:", error);
      alert(`Export failed: ${error.message}`);
    }
  }
  #initialize() {
    if (!this.#modal) return;
    this.#modal.addEventListener("click", (e) => this.#handleModalClick(e));
    this.#modal.addEventListener("change", () => this.updateEstimate());
    this.#modal.addEventListener("input", () => this.updateEstimate());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.#modal.classList.contains("active")) {
        this.hide();
      }
    });
  }
  #handleModalClick(event) {
    const { target } = event;
    if (target.id === "modal-close" || target.id === "modal-cancel") {
      this.hide();
    } else if (target.id === "modal-export") {
      this.handleExport();
    } else if (target === this.#modal) {
      this.hide();
    }
  }
  #updateModalInfo(totalPages) {
    const updates = {
      "modal-total-pages": totalPages,
      "num-files": { max: totalPages },
      "pages-per-file": { max: totalPages },
      "range-start": { max: totalPages },
      "range-end": { max: totalPages, value: totalPages },
    };
    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (!element) return;
      if (typeof value === "object") {
        Object.entries(value).forEach(([prop, val]) => {
          element[prop] = val;
        });
      } else {
        element.textContent = value;
      }
    });
  }
  #getSelectedMode() {
    return document.querySelector('input[name="split-mode"]:checked')?.value;
  }
  #getInputValues() {
    const getValue = (id) => {
      const element = document.getElementById(id);
      return element?.value || "";
    };
    return {
      numFiles: parseInt(getValue("num-files")) || 2,
      pagesPerFile: parseInt(getValue("pages-per-file")) || 10,
      rangeStart: parseInt(getValue("range-start")) || 1,
      rangeEnd: parseInt(getValue("range-end")) || 1,
      customPages: getValue("custom-pages"),
    };
  }
  #calculateEstimate(mode, totalPages) {
    const values = this.#getInputValues();
    const estimates = {
      all: () => `${totalPages} PDF files (1 page each)`,
      "by-files": () => {
        const pagesPerFile = Math.ceil(totalPages / values.numFiles);
        return `${values.numFiles} PDF files (~${pagesPerFile} pages each)`;
      },
      "by-pages": () => {
        const numFiles = Math.ceil(totalPages / values.pagesPerFile);
        return `${numFiles} PDF files (${values.pagesPerFile} pages each)`;
      },
      range: () => {
        const validation = validateRange(
          values.rangeStart,
          values.rangeEnd,
          totalPages
        );
        if (!validation.valid) return validation.error;
        return `1 PDF file (${values.rangeEnd - values.rangeStart + 1} pages)`;
      },
      custom: () => {
        const pages = parsePageSpec(values.customPages, totalPages);
        if (!pages.length) return "Enter page numbers";
        return `1 PDF file (${pages.length} pages)`;
      },
    };
    return estimates[mode]?.() || "-";
  }
  async #exportByFiles() {
    const { numFiles } = this.#getInputValues();
    await this.#pdfExporter.splitByNumberOfFiles(
      numFiles,
      this.#pdfName,
      this.#pageManager
    );
  }
  async #exportByPages() {
    const { pagesPerFile } = this.#getInputValues();
    await this.#pdfExporter.splitByPagesPerFile(
      pagesPerFile,
      this.#pdfName,
      this.#pageManager
    );
  }
  async #exportRange() {
    const { rangeStart, rangeEnd } = this.#getInputValues();
    await this.#pdfExporter.exportPageRange(
      rangeStart,
      rangeEnd,
      this.#pdfName,
      this.#pageManager
    );
  }
  async #exportCustom() {
    const { customPages } = this.#getInputValues();
    await this.#pdfExporter.exportSpecificPages(
      customPages,
      this.#pdfName,
      this.#pageManager
    );
  }
}
