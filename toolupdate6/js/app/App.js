import { StateManager } from "../core/StateManager.js";
import { OverlayMerger } from "../core/OverlayMerger.js";
import { PDFHandler } from "../core/PDFHandler.js";
import {
  CoordinateManager,
  CoordinateControls,
} from "../core/CoordinateSystem.js";
import { FontSizeCalculator } from "../services/FontSizeCalculator.js";
import { Exporters } from "../services/Exporters.js";
import { PDFExporter } from "../services/PDFExporter.js";
import { OverlayRenderer } from "../ui/OverlayRenderer.js";
import { PageManager } from "../ui/PageManager.js";
import { ThemeControls } from "../ui/ThemeControls.js";
import { SplitModal } from "../ui/SplitModal.js";
import { CONFIG } from "../config.js";
import {
  readFile,
  withErrorHandling,
  createButtonHandler,
  forceUIUpdate,
  formatMessage,
} from "../utils.js";
import {
  ActionRegistry,
  FileHandler,
  KeyboardShortcuts,
} from "./AppServices.js";
export class PDFOverlayApp {
  #defaultJson;
  #state;
  #managers;
  #services;
  #ui;
  #actionRegistry;
  #fileHandler;
  #shortcuts;
  #appState;
  constructor(defaultJson) {
    this.#defaultJson = defaultJson;
    this.#appState = {
      pdfName: "document",
      lastPdfData: null,
      renderedPages: new Set(),
      isOperationRunning: false,
    };
    this.#initializeComponents();
    this.#setupEventListeners();
    this.#initialize();
  }
  #initializeComponents() {
    pdfjsLib.GlobalWorkerOptions.workerSrc = CONFIG.PDF.WORKER_SRC;
    this.#state = new StateManager();
    this.#managers = {
      pdf: new PDFHandler(),
      coord: new CoordinateManager(this.#state),
      merger: new OverlayMerger(),
    };
    this.#services = {
      fontCalc: new FontSizeCalculator(),
      exporters: new Exporters(this.#managers.pdf),
      pdfExporter: new PDFExporter(this.#managers.pdf),
    };
    const pageManager = new PageManager();
    this.#ui = {
      page: pageManager,
      renderer: new OverlayRenderer(this.#state, this.#services.fontCalc),
      theme: new ThemeControls(this.#state, this.#services.fontCalc),
      coord: new CoordinateControls(this.#managers.coord),
      split: new SplitModal(
        this.#services.pdfExporter,
        this.#managers.pdf,
        pageManager
      ),
    };
    this.#actionRegistry = new ActionRegistry(this);
    this.#fileHandler = new FileHandler(this);
    this.#shortcuts = new KeyboardShortcuts(this.#actionRegistry);
  }
  #setupEventListeners() {
    this.#fileHandler.attachFileInputs();
    this.#actionRegistry.attachButtons();
    this.#setupThemeToggle();
    this.#setupCustomEvents();
    this.#shortcuts.initialize();
  }
  #setupThemeToggle() {
    const themeToggle = document.getElementById("theme-toggle");
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem("theme") || "light";
    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme");
    }
    themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      const theme = document.body.classList.contains("dark-theme")
        ? "dark"
        : "light";
      localStorage.setItem("theme", theme);
    });
  }
  #setupCustomEvents() {
    const events = {
      coordinateOrderChanged: () => this.render(),
      reloadAllPages: () => this.render(),
      exportSinglePage: (e) => this.#handleSinglePageExport(e.detail.pageNum),
    };
    Object.entries(events).forEach(([eventName, handler]) => {
      document.addEventListener(eventName, handler);
    });
  }
  #initialize() {
    this.#ui.theme.initialize();
    this.#managers.coord.initialize();
    this.processAndLoad(this.#defaultJson);
  }
  async handlePDFUpload(file) {
    await withErrorHandling(async () => {
      this.#ui.page.updateFileName(
        document.getElementById("pdf-file-name"),
        file.name,
        CONFIG.MESSAGES.NO_FILE
      );
      this.#appState.lastPdfData = await readFile(file, "readAsArrayBuffer");
      this.#appState.pdfName = file.name.replace(/\.pdf$/i, "");
      const jsonInput = document.getElementById("json-input");
      jsonInput.value = "";
      this.#ui.page.updateFileName(
        document.getElementById("json-file-name"),
        null,
        CONFIG.MESSAGES.USING_DEFAULT
      );
      await this.processAndLoad(this.#defaultJson);
    }, CONFIG.MESSAGES.PDF_LOAD_ERROR);
  }
  async handleJSONUpload(file) {
    await withErrorHandling(async () => {
      if (this.#managers.pdf.isLoaded()) {
        const proceed = confirm(CONFIG.MESSAGES.JSON_MISMATCH_WARNING);
        if (!proceed) return;
      }
      this.#ui.page.updateFileName(
        document.getElementById("json-file-name"),
        file.name,
        CONFIG.MESSAGES.USING_DEFAULT
      );
      const jsonText = await readFile(file, "readAsText");
      await this.processAndLoad(JSON.parse(jsonText));
    }, "Failed to load JSON");
  }
  async handleExpandAll() {
    const input = document.getElementById("expand-amount");
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount < CONFIG.VALIDATION.MIN_EXPAND_AMOUNT) {
      alert(CONFIG.MESSAGES.INVALID_EXPAND_AMOUNT);
      return;
    }
    if (amount > CONFIG.VALIDATION.EXPAND_WARNING_THRESHOLD) {
      const message = formatMessage(CONFIG.MESSAGES.EXPAND_LARGE_WARNING, {
        amount,
      });
      if (!confirm(message)) return;
    }
    this.#state.expandAllOverlays(amount);
    await this.render();
  }
  async handleSplitPDF() {
    if (!this.#managers.pdf.isLoaded()) {
      alert("Please load a PDF file first.");
      return;
    }
    const indicator = this.#ui.page.showSavingIndicator("Preparing pages...");
    await forceUIUpdate();
    try {
      await this.#managers.pdf.renderAllQueuedPages();
      this.#ui.page.removeSavingIndicator(indicator);
      await forceUIUpdate();
      this.#ui.split.show(this.#appState.pdfName);
    } catch (error) {
      this.#ui.page.removeSavingIndicator(indicator);
      throw error;
    }
  }
  async handlePrint() {
    if (!this.#managers.pdf.isLoaded()) {
      alert("Please load a PDF file first.");
      return;
    }
    await this.#services.exporters.print(this.#ui.page);
  }
  async handleExportPDF() {
    if (!this.#managers.pdf.isLoaded()) {
      alert("Please load a PDF file first.");
      return;
    }
    const indicator = this.#ui.page.showSavingIndicator(
      "Starting PDF export..."
    );
    await forceUIUpdate();
    try {
      await this.#managers.pdf.renderAllQueuedPages();
      await this.#services.pdfExporter.save(
        this.#appState.pdfName,
        this.#ui.page
      );
    } finally {
      this.#ui.page.removeSavingIndicator(indicator);
    }
  }
  async handleExportHTML() {
    if (!this.#managers.pdf.isLoaded()) {
      alert("Please load a PDF file first.");
      return;
    }
    const indicator = this.#ui.page.showSavingIndicator(
      "Starting HTML export..."
    );
    await forceUIUpdate();
    try {
      await this.#managers.pdf.renderAllQueuedPages();
      await this.#services.exporters.html(
        this.#appState.pdfName,
        this.#ui.page
      );
    } finally {
      this.#ui.page.removeSavingIndicator(indicator);
    }
  }
  async #handleSinglePageExport(pageNum) {
    if (!this.#managers.pdf.isLoaded()) {
      alert("Please load a PDF file first.");
      return;
    }
    const indicator = this.#ui.page.showSavingIndicator(
      `Preparing page ${pageNum}...`
    );
    await forceUIUpdate();
    try {
      if (!this.#appState.renderedPages.has(pageNum)) {
        const wrapper = document.querySelector(`#page-wrapper-${pageNum}`);
        if (wrapper) {
          await this.#managers.pdf.renderPageToCanvas(
            wrapper,
            pageNum,
            CONFIG.PDF.SCALE
          );
          this.#appState.renderedPages.add(pageNum);
        }
      }
      await this.#services.pdfExporter.saveSinglePage(
        pageNum,
        this.#appState.pdfName,
        this.#ui.page
      );
    } finally {
      this.#ui.page.removeSavingIndicator(indicator);
    }
  }
  async processAndLoad(jsonData) {
    this.#state.initialize(jsonData);
    if (!this.#appState.lastPdfData) return;
    await withErrorHandling(async () => {
      this.#ui.page.showLoading(CONFIG.MESSAGES.LOADING_PDF);
      await forceUIUpdate();
      await this.#managers.pdf.loadPDF(this.#appState.lastPdfData);
      this.#ui.page.updatePageInfo(
        `Total pages: ${this.#managers.pdf.pdfDoc.numPages}`
      );
      await this.render();
    }, "Failed to process PDF");
  }
  async render() {
    console.log("🔴 App.render() started");
    if (!this.#managers.pdf.isLoaded()) {
      console.warn("⚠️ PDF not loaded, skipping render");
      return;
    }
    this.#appState.renderedPages.clear();
    console.log("🔴 App.render() - overlayData:", this.#state.overlayData);
    console.log(
      "🔴 App.render() - overlayData size:",
      this.#state.overlayData.size
    );
    const mergedData = this.#managers.merger.mergeAllPages(
      this.#state.overlayData,
      this.#state
    );
    console.log("🔴 App.render() - mergedData:", mergedData);
    console.log("🔴 App.render() - mergedData keys:", Object.keys(mergedData));
    this.#ui.page.clearContainer();
    this.#managers.pdf.resetRenderQueue();
    const totalPages = this.#managers.pdf.getNumPages();
    console.log("🔴 App.render() - total pages:", totalPages);
    const pages = await Promise.all(
      Array.from({ length: totalPages }, (_, i) =>
        this.#managers.pdf.getPage(i + 1)
      )
    );
    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const viewport = page.getViewport({ scale: CONFIG.PDF.SCALE });
      const wrapper = this.#ui.page.createPageWrapper(pageNum, viewport);
      this.#managers.pdf.queuePageForRender(wrapper, async () => {
        await this.#managers.pdf.renderPageToCanvas(
          wrapper,
          pageNum,
          CONFIG.PDF.SCALE
        );
        this.#appState.renderedPages.add(pageNum);
        this.#ui.coord.addPageControls(wrapper, pageNum, this.#state, () => {
          this.#ui.renderer.renderPageOverlays(
            wrapper,
            pageNum,
            { width: wrapper.clientWidth, height: wrapper.clientHeight },
            mergedData
          );
        });
        console.log(`🔴 Rendering overlays for page ${pageNum}`);
        this.#ui.renderer.renderPageOverlays(
          wrapper,
          pageNum,
          { width: wrapper.clientWidth, height: wrapper.clientHeight },
          mergedData
        );
      });
    });
    this.#managers.pdf.startObserving();
    console.log("✅ App.render() complete");
  }
  checkOperationLock() {
    if (this.#appState.isOperationRunning) {
      alert(CONFIG.MESSAGES.OPERATION_IN_PROGRESS);
      return true;
    }
    return false;
  }
  setOperationLock(value) {
    this.#appState.isOperationRunning = value;
  }
}
