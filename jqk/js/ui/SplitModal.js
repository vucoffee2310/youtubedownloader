import {
  parsePageSpec,
  formatPageList,
  validateRange,
  formatMessage,
} from "../utils.js";
import { CONFIG } from "../config.js";

export class SplitModal {
  #pdfExporter;
  #pdfHandler;
  #pageManager;
  #pdfName;
  #modal;
  constructor(pdfExporter, pdfHandler, pageManager) {
    this.#pdfExporter = pdfExporter;
    this.#pdfHandler = pdfHandler;
    this.#pageManager = pageManager;
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
    const totalPages = this.#pdfHandler.getNumPages();
    const values = this.#getInputValues();
    const error = this.#validateMode(mode, values, totalPages);
    if (error) {
      alert(error);
      return;
    }
    this.hide();
    try {
      switch (mode) {
        case "all":
          await this.#pdfExporter.splitPDF(this.#pdfName);
          break;
        case "by-files":
          await this.#pdfExporter.splitByNumberOfFiles(
            values.numFiles,
            this.#pdfName
          );
          break;
        case "by-pages":
          await this.#pdfExporter.splitByPagesPerFile(
            values.pagesPerFile,
            this.#pdfName
          );
          break;
        case "range":
          await this.#pdfExporter.exportPageRange(
            values.rangeStart,
            values.rangeEnd,
            this.#pdfName
          );
          break;
        case "custom":
          await this.#pdfExporter.exportSpecificPages(
            values.customPages,
            this.#pdfName
          );
          break;
      }
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
  #validateMode(mode, values, totalPages) {
    switch (mode) {
      case "all":
        return null;
      case "by-files":
        if (!values.numFiles || values.numFiles < 2) {
          return "Number of files must be at least 2";
        }
        return null;
      case "by-pages":
        if (!values.pagesPerFile || values.pagesPerFile < 1) {
          return "Pages per file must be at least 1";
        }
        return null;
      case "range": {
        const validation = validateRange(
          values.rangeStart,
          values.rangeEnd,
          totalPages
        );
        return validation.valid ? null : validation.error;
      }
      case "custom":
        if (!values.customPages?.trim()) {
          return "Please enter page numbers";
        }
        const pages = parsePageSpec(values.customPages, totalPages);
        if (!pages.length) {
          return CONFIG.MESSAGES.INVALID_PAGE_SPEC;
        }
        return null;
      default:
        return "Invalid mode";
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
    const getValue = (id) => document.getElementById(id)?.value || "";
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
    switch (mode) {
      case "all":
        return `${totalPages} PDF files (1 page each)`;
      case "by-files": {
        const pagesPerFile = Math.ceil(totalPages / values.numFiles);
        return `${values.numFiles} PDF files (~${pagesPerFile} pages each)`;
      }
      case "by-pages": {
        const numFiles = Math.ceil(totalPages / values.pagesPerFile);
        return `${numFiles} PDF files (${values.pagesPerFile} pages each)`;
      }
      case "range": {
        const validation = validateRange(
          values.rangeStart,
          values.rangeEnd,
          totalPages
        );
        if (!validation.valid) return validation.error;
        const count = values.rangeEnd - values.rangeStart + 1;
        return `1 PDF file (${count} pages)`;
      }
      case "custom": {
        const pages = parsePageSpec(values.customPages, totalPages);
        if (!pages.length) return "Enter page numbers";
        return `1 PDF file (${pages.length} pages)`;
      }
      default:
        return "-";
    }
  }
}