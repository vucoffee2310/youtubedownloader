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
import { FileHandler } from "./AppServices.js";

export class PDFOverlayApp {
  #defaultJson;
  #state;
  #managers;
  #services;
  #ui;
  #fileHandler;
  #appState;

  constructor(defaultJson) {
    this.#defaultJson = defaultJson;
    this.#appState = {
      pdfName: "document",
      lastPdfData: null,
      renderedPages: new Set(),
      isOperationRunning: false,
      pdfPages: new Map(),
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

    this.#fileHandler = new FileHandler(this);
  }

  #setupEventListeners() {
    this.#fileHandler.attachFileInputs();
    this.#attachButtons();
    this.#setupThemeToggle();
    this.#setupCustomEvents();
    this.#setupKeyboardShortcuts();
  }

  #attachButtons() {
    const actions = {
      "expand-all-btn": () => this.handleExpandAll(),
      "split-pdf-btn": () => this.handleSplitPDF(),
      "save-print-btn": () => this.handlePrint(),
      "save-direct-pdf-btn": () => this.handleExportPDF(),
      "save-html-btn": () => this.handleExportHTML(),
    };

    Object.entries(actions).forEach(([id, action]) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      btn.addEventListener(
        "click",
        createButtonHandler(btn, async () => {
          if (this.#appState.isOperationRunning) {
            alert(CONFIG.MESSAGES.OPERATION_IN_PROGRESS);
            return;
          }
          this.#appState.isOperationRunning = true;
          try {
            await action();
          } finally {
            this.#appState.isOperationRunning = false;
          }
        })
      );
    });
  }

  #setupThemeToggle() {
    const toggle = document.getElementById("theme-toggle");
    if (!toggle) return;

    if (localStorage.getItem("theme") === "dark")
      document.body.classList.add("dark-theme");

    toggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-theme");
      localStorage.setItem(
        "theme",
        document.body.classList.contains("dark-theme") ? "dark" : "light"
      );
    });
  }

  #setupCustomEvents() {
    document.addEventListener("coordinateOrderChanged", () => this.render());
    document.addEventListener("reloadAllPages", () => this.render());
    document.addEventListener("exportSinglePage", (e) =>
      this.#handleSinglePageExport(e.detail.pageNum)
    );
  }

  #setupKeyboardShortcuts() {
    const shortcuts = {
      S: "split-pdf-btn",
      E: "save-direct-pdf-btn",
      P: "save-print-btn",
      H: "save-html-btn",
    };

    document.addEventListener("keydown", (e) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;

      const active = document.activeElement;
      if (
        active?.tagName === "INPUT" ||
        active?.tagName === "TEXTAREA" ||
        active?.isContentEditable
      )
        return;

      const btnId = shortcuts[e.key.toUpperCase()];
      if (btnId) {
        e.preventDefault();
        document.getElementById(btnId)?.click();
      }
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

      document.getElementById("json-input").value = "";
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
      if (
        this.#managers.pdf.isLoaded() &&
        !confirm(CONFIG.MESSAGES.JSON_MISMATCH_WARNING)
      )
        return;

      this.#ui.page.updateFileName(
        document.getElementById("json-file-name"),
        file.name,
        CONFIG.MESSAGES.USING_DEFAULT
      );

      await this.processAndLoad(JSON.parse(await readFile(file, "readAsText")));
    }, "Failed to load JSON");
  }

  async handleExpandAll() {
    const amount = parseFloat(document.getElementById("expand-amount").value);
    if (isNaN(amount) || amount < CONFIG.VALIDATION.MIN_EXPAND_AMOUNT) {
      alert(CONFIG.MESSAGES.INVALID_EXPAND_AMOUNT);
      return;
    }

    if (
      amount > CONFIG.VALIDATION.EXPAND_WARNING_THRESHOLD &&
      !confirm(formatMessage(CONFIG.MESSAGES.EXPAND_LARGE_WARNING, { amount }))
    )
      return;

    this.#state.expandAllOverlays(amount);
    await this.render();
  }

  async handleSplitPDF() {
    if (!this.#managers.pdf.isLoaded())
      return alert("Please load a PDF file first.");

    await forceUIUpdate();
    await this.#managers.pdf.renderAllQueuedPages();
    await forceUIUpdate();

    this.#ui.split.show(this.#appState.pdfName);
  }

  async handlePrint() {
    if (!this.#managers.pdf.isLoaded())
      return alert("Please load a PDF file first.");

    await this.#services.exporters.print();
  }

  async handleExportPDF() {
    if (!this.#managers.pdf.isLoaded())
      return alert("Please load a PDF file first.");

    await forceUIUpdate();
    await this.#managers.pdf.renderAllQueuedPages();
    await this.#services.pdfExporter.save(this.#appState.pdfName);
  }

  async handleExportHTML() {
    if (!this.#managers.pdf.isLoaded())
      return alert("Please load a PDF file first.");

    await forceUIUpdate();
    await this.#managers.pdf.renderAllQueuedPages();
    await this.#services.exporters.html(this.#appState.pdfName);
  }

  async #handleSinglePageExport(pageNum) {
    if (!this.#managers.pdf.isLoaded())
      return alert("Please load a PDF file first.");

    await forceUIUpdate();

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
      this.#appState.pdfName
    );
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
    if (!this.#managers.pdf.isLoaded()) return;

    this.#appState.renderedPages.clear();
    this.#appState.pdfPages.clear();
    this.#ui.page.clearContainer();
    this.#managers.pdf.resetRenderQueue();

    const totalPages = this.#managers.pdf.getNumPages();
    const pages = await Promise.all(
      Array.from({ length: totalPages }, (_, i) =>
        this.#managers.pdf.getPage(i + 1)
      )
    );

    pages.forEach((page, i) => this.#appState.pdfPages.set(i + 1, page));

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
        this.#renderPageOverlays(wrapper, pageNum, page);
        this.#ui.coord.addPageControls(wrapper, pageNum, this.#state, () =>
          this.#renderPageOverlays(wrapper, pageNum, page)
        );
      });
    });

    this.#managers.pdf.startObserving();
  }

  #renderPageOverlays(wrapper, pageNum, pdfPage) {
    const pageData = this.#state.overlayData.get(`page_${pageNum}`);
    if (!pageData) return;

    const coordOrder = this.#state.getPageCoordinateOrder(pageNum);
    const mergedBlocks = this.#managers.merger.mergePage(pageData, coordOrder);
    const pdfViewport = pdfPage.getViewport({ scale: 1.0 });

    const canvas = wrapper.querySelector("canvas");
    const containerDimensions = canvas
      ? { width: canvas.offsetWidth, height: canvas.offsetHeight }
      : { width: wrapper.clientWidth, height: wrapper.clientHeight };

    this.#ui.renderer.renderPageOverlays(
      wrapper,
      pageNum,
      containerDimensions,
      { width: pdfViewport.width, height: pdfViewport.height },
      { width: pageData.width, height: pageData.height, blocks: mergedBlocks }
    );
  }
}
