import { CONFIG } from "../config.js";

class FontManager {
  #fontCache;
  #loadingPromises;
  constructor() {
    this.#fontCache = new Map();
    this.#loadingPromises = new Map();
  }
  async loadFont(type = "main") {
    if (this.#fontCache.has(type)) {
      return this.#fontCache.get(type);
    }
    if (this.#loadingPromises.has(type)) {
      return this.#loadingPromises.get(type);
    }
    const promise = this.#fetchFont(type);
    this.#loadingPromises.set(type, promise);
    try {
      const fontData = await promise;
      this.#fontCache.set(type, fontData);
      return fontData;
    } catch (error) {
      this.#loadingPromises.delete(type);
      throw error;
    }
  }
  async #fetchFont(type) {
    const fontConfig = type === "code" ? CONFIG.CODE_FONT : CONFIG.FONT;
    try {
      const response = await fetch(fontConfig.URL);
      if (!response.ok) {
        throw new Error(`Font not found: ${fontConfig.URL}`);
      }
      const blob = await response.blob();
      const base64 = await this.#blobToBase64(blob);
      return base64;
    } catch (error) {
      console.error(`Font load failed (${fontConfig.NAME}):`, error);
      this.#dispatchFontError(fontConfig.NAME, fontConfig.FILE);
      return null;
    }
  }
  #blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  #dispatchFontError(name, file) {
    document.dispatchEvent(
      new CustomEvent("fontLoadError", {
        detail: {
          name,
          file,
          message: CONFIG.MESSAGES.FONT_LOAD_ERROR,
        },
      })
    );
  }
  clearCache() {
    this.#fontCache.clear();
    this.#loadingPromises.clear();
  }
  hasCachedFont(type) {
    return this.#fontCache.has(type);
  }
}

class RenderQueue {
  #queue;
  constructor() {
    this.#queue = new Map();
  }
  add(wrapper, task) {
    this.#queue.set(wrapper, task);
  }
  remove(wrapper) {
    this.#queue.delete(wrapper);
  }
  getTask(wrapper) {
    return this.#queue.get(wrapper);
  }
  getAllTasks() {
    return Array.from(this.#queue.values());
  }
  clear() {
    this.#queue.clear();
  }
  size() {
    return this.#queue.size;
  }
  has(wrapper) {
    return this.#queue.has(wrapper);
  }
  forEach(callback) {
    this.#queue.forEach(callback);
  }
}

export class PDFHandler {
  #fontManager;
  #renderQueue;
  #pageCache;
  #observer;
  constructor() {
    this.pdfDoc = null;
    this.#fontManager = new FontManager();
    this.#renderQueue = new RenderQueue();
    this.#pageCache = new Map();
    this.#observer = null;
  }
  isLoaded() {
    return !!this.pdfDoc;
  }
  getNumPages() {
    return this.pdfDoc?.numPages || 0;
  }
  async getPage(pageNum) {
    const key = `page_${pageNum}`;
    if (this.#pageCache.has(key)) {
      return this.#pageCache.get(key);
    }
    const page = await this.pdfDoc.getPage(pageNum);
    if (this.#pageCache.size >= CONFIG.CACHE.MAX_PAGE_CACHE) {
      const firstKey = this.#pageCache.keys().next().value;
      this.#pageCache.delete(firstKey);
    }
    this.#pageCache.set(key, page);
    return page;
  }
  async loadFont(type = "main") {
    return this.#fontManager.loadFont(type);
  }
  async loadCodeFont() {
    return this.#fontManager.loadFont("code");
  }
  async loadPDF(data) {
    try {
      this.#pageCache.clear();
      this.pdfDoc = await pdfjsLib.getDocument(data).promise;
      this.#dispatchEvent("pdfLoaded", { numPages: this.pdfDoc.numPages });
      return this.pdfDoc;
    } catch (error) {
      this.#dispatchEvent("pdfLoadError", { error });
      throw error;
    }
  }
  async renderPageToCanvas(wrapper, pageNum, scale) {
    if (!wrapper || wrapper.dataset.rendered) return;
    try {
      const page = await this.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false,
      });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({
        canvasContext: ctx,
        viewport,
        intent: CONFIG.PDF.RENDER_INTENT,
      }).promise;
      const exportControls = wrapper.querySelector(".page-export-controls");
      wrapper.innerHTML = "";
      wrapper.classList.remove("page-placeholder");
      wrapper.appendChild(canvas);
      if (exportControls) wrapper.appendChild(exportControls);
      wrapper.dataset.rendered = "true";
      this.#dispatchEvent("pageRendered", { pageNum });
    } catch (error) {
      wrapper.innerHTML = `<span>Error loading page ${pageNum}</span>`;
      this.#dispatchEvent("pageRenderError", { pageNum, error });
    }
  }
  resetRenderQueue() {
    this.#observer?.disconnect();
    this.#renderQueue.clear();
  }
  queuePageForRender(wrapper, task) {
    this.#renderQueue.add(wrapper, task);
  }
  startObserving() {
    this.#observer = new IntersectionObserver(
      (entries) => this.#handleIntersection(entries),
      {
        rootMargin: CONFIG.RENDER.INTERSECTION_ROOT_MARGIN,
        threshold: CONFIG.RENDER.INTERSECTION_THRESHOLD,
      }
    );
    document
      .querySelectorAll(".page-placeholder")
      .forEach((el) => this.#observer.observe(el));
  }
  async renderAllQueuedPages() {
    if (!this.#renderQueue.size()) return;
    this.#observer?.disconnect();
    const tasks = this.#renderQueue.getAllTasks();
    for (let i = 0; i < tasks.length; i += CONFIG.PDF.RENDER_BATCH_SIZE) {
      await Promise.all(
        tasks.slice(i, i + CONFIG.PDF.RENDER_BATCH_SIZE).map((t) => t())
      );
    }
    this.#renderQueue.clear();
  }
  clearCache() {
    this.#pageCache.clear();
  }
  clearFontCache() {
    this.#fontManager.clearCache();
  }
  clearAllCaches() {
    this.clearCache();
    this.clearFontCache();
  }
  #handleIntersection(entries) {
    entries
      .filter((e) => e.isIntersecting)
      .map((e) => ({
        entry: e,
        distance: Math.abs(
          e.boundingClientRect.top +
            e.boundingClientRect.height /
              CONFIG.RENDER.QUEUE_SORT_WINDOW_CENTER -
            window.innerHeight / CONFIG.RENDER.QUEUE_SORT_WINDOW_CENTER
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .forEach(({ entry }) => {
        const task = this.#renderQueue.getTask(entry.target);
        if (task) {
          task();
          this.#renderQueue.remove(entry.target);
          this.#observer.unobserve(entry.target);
        }
      });
  }
  #dispatchEvent(type, detail = {}) {
    document.dispatchEvent(
      new CustomEvent("pdfHandler", {
        detail: { type, ...detail },
      })
    );
  }
}
