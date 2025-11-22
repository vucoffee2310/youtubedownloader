import { CONFIG } from "../config.js";
import {
  parsePageSpec,
  formatPageList,
  validateRange,
  withErrorHandling,
  forceUIUpdate,
  formatMessage,
  padNumber,
} from "../utils.js";
import { PDFRenderer } from "../renderers/PDFRenderer.js";

class PDFFactory {
  #pdfHandler;
  constructor(pdfHandler) {
    this.#pdfHandler = pdfHandler;
  }
  async create(wrapper) {
    const pdf = new jspdf.jsPDF({
      orientation: wrapper.clientWidth > wrapper.clientHeight ? "l" : "p",
      unit: "pt",
      format: [wrapper.clientWidth, wrapper.clientHeight],
      compress: true,
    });
    await this.#embedFonts(pdf);
    return pdf;
  }
  async #embedFonts(pdf) {
    await Promise.all([
      this.#embedFont(pdf, CONFIG.FONT, () =>
        this.#pdfHandler.loadFont("main")
      ),
      this.#embedFont(pdf, CONFIG.CODE_FONT, () =>
        this.#pdfHandler.loadFont("code")
      ),
    ]);
  }
  async #embedFont(pdf, fontConfig, loader) {
    const fontData = await loader();
    if (!fontData) {
      console.warn(
        `Font "${fontConfig.NAME}" not loaded, PDF will use default font.`
      );
      return;
    }
    try {
      pdf.addFileToVFS(fontConfig.FILE, fontData);
      ["normal", "bold", "italic", "bolditalic"].forEach((style) => {
        pdf.addFont(fontConfig.FILE, fontConfig.NAME, style);
      });
    } catch (error) {
      console.error(`Failed to embed font "${fontConfig.NAME}":`, error);
    }
  }
}

class ExportStrategy {
  static combined(pageNumbers, filename) {
    return new CombinedExportStrategy(pageNumbers, filename);
  }
  static split(pageNumbers, filenameBase, pagesPerFile = 1) {
    return new SplitExportStrategy(pageNumbers, filenameBase, pagesPerFile);
  }
}

class CombinedExportStrategy {
  constructor(pageNumbers, filename) {
    this.pageNumbers = pageNumbers;
    this.filename = filename;
  }
  async execute({ preparePage, createPDF, addPage, updateProgress }) {
    const firstWrapper = document.querySelector(
      `#page-wrapper-${this.pageNumbers[0]}`
    );
    const pdf = await createPDF(firstWrapper);
    for (let i = 0; i < this.pageNumbers.length; i++) {
      const pageNum = this.pageNumbers[i];
      updateProgress(
        `Processing page ${pageNum} (${i + 1}/${this.pageNumbers.length})...`
      );
      const wrapper = document.querySelector(`#page-wrapper-${pageNum}`);
      if (wrapper) {
        const pageData = await preparePage(wrapper, pageNum);
        addPage(pdf, pageData, i === 0);
      }
      if (i % CONFIG.PDF.RENDER_BATCH_SIZE === 0) {
        await new Promise((r) => setTimeout(r, CONFIG.RENDER.BATCH_DELAY));
      }
    }
    updateProgress("Saving PDF...");
    pdf.save(this.filename);
  }
}
class SplitExportStrategy {
  constructor(pageNumbers, filenameBase, pagesPerFile) {
    this.pageNumbers = pageNumbers;
    this.filenameBase = filenameBase;
    this.pagesPerFile = pagesPerFile;
  }
  async execute({ preparePage, createPDF, addPage, updateProgress }) {
    const totalGroups = Math.ceil(this.pageNumbers.length / this.pagesPerFile);
    for (let i = 0; i < this.pageNumbers.length; i += this.pagesPerFile) {
      const group = this.pageNumbers.slice(i, i + this.pagesPerFile);
      const groupIndex = Math.floor(i / this.pagesPerFile) + 1;
      const [startPage, endPage] = [group[0], group[group.length - 1]];
      updateProgress(
        `Creating file ${groupIndex}/${totalGroups} (pages ${startPage}-${endPage})...`
      );
      const firstWrapper = document.querySelector(`#page-wrapper-${startPage}`);
      const pdf = await createPDF(firstWrapper);
      for (let j = 0; j < group.length; j++) {
        const wrapper = document.querySelector(`#page-wrapper-${group[j]}`);
        if (wrapper) {
          const pageData = await preparePage(wrapper, group[j]);
          addPage(pdf, pageData, j === 0);
        }
      }
      const filename = this.#generateFilename(startPage, endPage);
      pdf.save(filename);
      await new Promise((r) => setTimeout(r, CONFIG.EXPORT.PDF_SAVE_DELAY));
    }
  }
  #generateFilename(startPage, endPage) {
    if (this.pagesPerFile === 1) {
      return `${this.filenameBase}_page_${padNumber(startPage)}.pdf`;
    }
    return `${this.filenameBase}_pages_${padNumber(startPage)}_to_${padNumber(
      endPage
    )}.pdf`;
  }
}

export class PDFExporter {
  #pdf;
  #renderer;
  #factory;
  constructor(pdfHandler) {
    this.#pdf = pdfHandler;
    this.#renderer = new PDFRenderer();
    this.#factory = new PDFFactory(pdfHandler);
  }
  async save(name, ui) {
    const totalPages = this.#getTotalPages();
    const strategy = ExportStrategy.combined(
      Array.from({ length: totalPages }, (_, i) => i + 1),
      `${name}_export.pdf`
    );
    return this.#executeExport(strategy, ui);
  }
  async saveSinglePage(pageNum, name, ui) {
    const filename = `${name}_page_${padNumber(pageNum)}.pdf`;
    const strategy = ExportStrategy.combined([pageNum], filename);
    return this.#executeExport(strategy, ui);
  }
  async splitPDF(name, ui) {
    const totalPages = this.#getTotalPages();
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_ALL_CONFIRM, {
      total: totalPages,
    });
    if (!confirm(message)) return;
    const strategy = ExportStrategy.split(
      Array.from({ length: totalPages }, (_, i) => i + 1),
      name
    );
    return this.#executeExport(strategy, ui);
  }
  async splitByNumberOfFiles(numFiles, name, ui) {
    const totalPages = this.#getTotalPages();
    const pagesPerFile = Math.ceil(totalPages / numFiles);
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_BY_FILES_CONFIRM, {
      total: totalPages,
      numFiles,
      pagesPerFile,
    });
    if (!confirm(message)) return;
    const strategy = ExportStrategy.split(
      Array.from({ length: totalPages }, (_, i) => i + 1),
      name,
      pagesPerFile
    );
    return this.#executeExport(strategy, ui);
  }
  async splitByPagesPerFile(pagesPerFile, name, ui) {
    const totalPages = this.#getTotalPages();
    const numFiles = Math.ceil(totalPages / pagesPerFile);
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_BY_PAGES_CONFIRM, {
      pagesPerFile,
      numFiles,
    });
    if (!confirm(message)) return;
    const strategy = ExportStrategy.split(
      Array.from({ length: totalPages }, (_, i) => i + 1),
      name,
      pagesPerFile
    );
    return this.#executeExport(strategy, ui);
  }
  async exportPageRange(start, end, name, ui) {
    const validation = validateRange(start, end, this.#getTotalPages());
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    const filename = `${name}_pages_${padNumber(start)}_to_${padNumber(
      end
    )}.pdf`;
    const strategy = ExportStrategy.combined(
      Array.from({ length: end - start + 1 }, (_, i) => start + i),
      filename
    );
    return this.#executeExport(strategy, ui);
  }
  async exportSpecificPages(pageSpec, name, ui) {
    const totalPages = this.#getTotalPages();
    const pageNumbers = parsePageSpec(pageSpec, totalPages);
    if (!pageNumbers.length) {
      alert(CONFIG.MESSAGES.INVALID_PAGE_SPEC);
      return;
    }
    const message = formatMessage(CONFIG.MESSAGES.EXPORT_PAGES_CONFIRM, {
      count: pageNumbers.length,
      list: formatPageList(pageNumbers),
    });
    if (!confirm(message)) return;
    const filename =
      pageNumbers.length === 1
        ? `${name}_page_${padNumber(pageNumbers[0])}.pdf`
        : `${name}_selected_${pageNumbers.length}_pages.pdf`;
    const strategy = ExportStrategy.combined(pageNumbers, filename);
    return this.#executeExport(strategy, ui);
  }
  async #executeExport(strategy, ui) {
    return withErrorHandling(async () => {
      const indicator = ui.showSavingIndicator("Preparing export...");
      await forceUIUpdate();
      try {
        await strategy.execute({
          preparePage: (wrapper, pageNum) =>
            this.#preparePage(wrapper, pageNum),
          createPDF: (wrapper) => this.#factory.create(wrapper),
          addPage: (pdf, pageData, isFirst) =>
            this.#addPage(pdf, pageData, isFirst),
          updateProgress: (message) => {
            indicator.textContent = message;
          },
        });
      } finally {
        ui.removeSavingIndicator(indicator);
      }
    }, "Export failed");
  }
  async #preparePage(wrapper, pageNum) {
    let canvas = wrapper.querySelector("canvas");
    if (!canvas) {
      await this.#pdf.renderPageToCanvas(wrapper, pageNum, CONFIG.PDF.SCALE);
      canvas = wrapper.querySelector("canvas");
    }
    const imageData = await this.#canvasToDataURL(canvas);
    const overlays = Array.from(wrapper.querySelectorAll(".overlay"))
      .map((el) => this.#renderer.extractOverlay(el, wrapper))
      .filter(Boolean);
    return {
      imageData,
      overlays,
      width: wrapper.clientWidth,
      height: wrapper.clientHeight,
    };
  }
  async #canvasToDataURL(canvas) {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Canvas to Blob failed")),
        CONFIG.PDF.IMAGE_FORMAT,
        CONFIG.PDF.IMAGE_QUALITY
      );
    });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  #addPage(pdf, pageData, isFirst) {
    const { imageData, overlays, width, height } = pageData;
    if (!isFirst) {
      pdf.addPage([width, height], width > height ? "l" : "p");
    }
    pdf.addImage(imageData, "JPEG", 0, 0, width, height);
    this.#renderer.drawShapes(pdf, overlays);
    this.#renderer.drawText(pdf, overlays);
  }
  #getTotalPages() {
    return document.querySelectorAll(".page-wrapper:not(.page-placeholder)")
      .length;
  }
}
