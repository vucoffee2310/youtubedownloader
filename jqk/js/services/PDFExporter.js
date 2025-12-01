import { CONFIG } from "../config.js";
import {
  parsePageSpec,
  formatPageList,
  validateRange,
  withErrorHandling,
  forceUIUpdate,
  formatMessage,
  padNumber,
  chunkArray,
} from "../utils.js";
import { PDFRenderer } from "../renderers/PDFRenderer.js";

export class PDFExporter {
  #pdf;
  #renderer;
  constructor(pdfHandler) {
    this.#pdf = pdfHandler;
    this.#renderer = new PDFRenderer();
  }
  async save(name) {
    const totalPages = this.#getTotalPages();
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return this.#exportPages(pages, `${name}_export.pdf`, null);
  }
  async saveSinglePage(pageNum, name) {
    const filename = `${name}_page_${padNumber(pageNum)}.pdf`;
    return this.#exportPages([pageNum], filename, null);
  }
  async splitPDF(name) {
    const totalPages = this.#getTotalPages();
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_ALL_CONFIRM, {
      total: totalPages,
    });
    if (!confirm(message)) return;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return this.#exportPages(pages, name, 1);
  }
  async splitByNumberOfFiles(numFiles, name) {
    const totalPages = this.#getTotalPages();
    const pagesPerFile = Math.ceil(totalPages / numFiles);
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_BY_FILES_CONFIRM, {
      total: totalPages,
      numFiles,
      pagesPerFile,
    });
    if (!confirm(message)) return;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return this.#exportPages(pages, name, pagesPerFile);
  }
  async splitByPagesPerFile(pagesPerFile, name) {
    const totalPages = this.#getTotalPages();
    const numFiles = Math.ceil(totalPages / pagesPerFile);
    const message = formatMessage(CONFIG.MESSAGES.SPLIT_BY_PAGES_CONFIRM, {
      pagesPerFile,
      numFiles,
    });
    if (!confirm(message)) return;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return this.#exportPages(pages, name, pagesPerFile);
  }
  async exportPageRange(start, end, name) {
    const validation = validateRange(start, end, this.#getTotalPages());
    if (!validation.valid) {
      alert(validation.error);
      return;
    }
    const filename = `${name}_pages_${padNumber(start)}_to_${padNumber(end)}.pdf`;
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return this.#exportPages(pages, filename, null);
  }
  async exportSpecificPages(pageSpec, name) {
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
    return this.#exportPages(pageNumbers, filename, null);
  }
  async #exportPages(pages, filenameOrBase, pagesPerFile) {
    return withErrorHandling(async () => {
      await forceUIUpdate();
      try {
        if (pagesPerFile === null) {
          await this.#exportCombined(pages, filenameOrBase);
        } else {
          await this.#exportSplit(pages, filenameOrBase, pagesPerFile);
        }
      } catch (e) {
        throw e;
      }
    }, "Export failed");
  }
  async #exportCombined(pages, filename) {
    const firstWrapper = document.querySelector(`#page-wrapper-${pages[0]}`);
    const pdf = await this.#createPDF(firstWrapper);
    for (let i = 0; i < pages.length; i++) {
      const pageNum = pages[i];
      const wrapper = document.querySelector(`#page-wrapper-${pageNum}`);
      if (wrapper) {
        const pageData = await this.#preparePage(wrapper, pageNum);
        this.#addPage(pdf, pageData, i === 0);
      }
      if (i % CONFIG.PDF.RENDER_BATCH_SIZE === 0) {
        await new Promise((r) => setTimeout(r, CONFIG.RENDER.BATCH_DELAY));
      }
    }
    pdf.save(filename);
  }
  async #exportSplit(pages, filenameBase, pagesPerFile) {
    const groups = chunkArray(pages, pagesPerFile);
    for (let groupIdx = 0; groupIdx < groups.length; groupIdx++) {
      const group = groups[groupIdx];
      const startPage = group[0];
      const endPage = group[group.length - 1];
      const firstWrapper = document.querySelector(`#page-wrapper-${startPage}`);
      const pdf = await this.#createPDF(firstWrapper);
      for (let j = 0; j < group.length; j++) {
        const wrapper = document.querySelector(`#page-wrapper-${group[j]}`);
        if (wrapper) {
          const pageData = await this.#preparePage(wrapper, group[j]);
          this.#addPage(pdf, pageData, j === 0);
        }
      }
      const filename = this.#generateSplitFilename(filenameBase, startPage, endPage, pagesPerFile);
      pdf.save(filename);
      await new Promise((r) => setTimeout(r, CONFIG.EXPORT.PDF_SAVE_DELAY));
    }
  }
  #generateSplitFilename(base, startPage, endPage, pagesPerFile) {
    if (pagesPerFile === 1) {
      return `${base}_page_${padNumber(startPage)}.pdf`;
    }
    return `${base}_pages_${padNumber(startPage)}_to_${padNumber(endPage)}.pdf`;
  }
  async #createPDF(wrapper) {
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
    const fontData = await this.#pdf.loadFont();
    if (!fontData) {
      console.warn(
        `Font "${CONFIG.FONT.NAME}" not loaded, PDF will use default font.`
      );
      return;
    }
    try {
      pdf.addFileToVFS(CONFIG.FONT.FILE, fontData);
      ["normal", "bold", "italic", "bolditalic"].forEach((style) => {
        pdf.addFont(CONFIG.FONT.FILE, CONFIG.FONT.NAME, style);
      });
    } catch (error) {
      console.error(`Failed to embed font "${CONFIG.FONT.NAME}":`, error);
    }
  }
  async #preparePage(wrapper, pageNum) {
    let canvas = wrapper.querySelector("canvas");
    if (!canvas) {
      await this.#pdf.renderPageToCanvas(wrapper, pageNum, CONFIG.PDF.SCALE);
      canvas = wrapper.querySelector("canvas");
    }
    const imageData = canvas.toDataURL(
      CONFIG.PDF.IMAGE_FORMAT,
      CONFIG.PDF.IMAGE_QUALITY
    );
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
  #addPage(pdf, pageData, isFirst) {
    const { imageData, overlays, width, height } = pageData;
    if (!isFirst) {
      pdf.addPage([width, height], width > height ? "l" : "p");
    }
    const format = CONFIG.PDF.IMAGE_FORMAT.replace("image/", "").toUpperCase();
    pdf.addImage(imageData, format, 0, 0, width, height, undefined, "FAST");
    this.#renderer.drawShapes(pdf, overlays);
    this.#renderer.drawText(pdf, overlays);
  }
  #getTotalPages() {
    return document.querySelectorAll(".page-wrapper:not(.page-placeholder)")
      .length;
  }
}