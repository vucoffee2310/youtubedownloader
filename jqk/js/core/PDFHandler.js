import { CONFIG } from "../config.js";
import { LRUCache } from "../utils.js";

export class PDFHandler {
  #fontData;
  #fontPromise;
  #renderQueue;
  #pageCache;
  #observer;

  constructor() {
    this.pdfDoc = null;
    this.#fontData = null;
    this.#fontPromise = null;
    this.#renderQueue = new Map();
    this.#pageCache = new LRUCache(CONFIG.CACHE.MAX_PAGE_CACHE);
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
    this.#pageCache.set(key, page);
    return page;
  }

  async loadFont() {
    if (this.#fontData) return this.#fontData;
    if (this.#fontPromise) return this.#fontPromise;

    this.#fontPromise = fetch(CONFIG.FONT.URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Font not found: ${CONFIG.FONT.URL}`);
        return response.blob();
      })
      .then((blob) => this.#blobToBase64(blob))
      .then((base64) => {
        this.#fontData = base64;
        return base64;
      })
      .catch((error) => {
        console.error(`Font load failed (${CONFIG.FONT.NAME}):`, error);
        console.warn(CONFIG.MESSAGES.FONT_LOAD_ERROR);
        return null;
      });

    return this.#fontPromise;
  }

  #blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async loadPDF(data) {
    try {
      this.#pageCache.clear();
      this.pdfDoc = await pdfjsLib.getDocument(data).promise;
      return this.pdfDoc;
    } catch (error) {
      console.error("PDF load error:", error);
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
    } catch (error) {
      console.error(`Error rendering page ${pageNum}:`, error);
      wrapper.innerHTML = `<span>Error loading page ${pageNum}</span>`;
    }
  }

  resetRenderQueue() {
    this.#observer?.disconnect();
    this.#renderQueue.clear();
  }

  queuePageForRender(wrapper, task) {
    this.#renderQueue.set(wrapper, task);
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
    if (!this.#renderQueue.size) return;

    this.#observer?.disconnect();

    const tasks = Array.from(this.#renderQueue.values());
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

  #handleIntersection(entries) {
    entries
      .filter((e) => e.isIntersecting)
      .map((e) => ({
        entry: e,
        distance: Math.abs(
          e.boundingClientRect.top +
            e.boundingClientRect.height / CONFIG.RENDER.QUEUE_SORT_WINDOW_CENTER -
            window.innerHeight / CONFIG.RENDER.QUEUE_SORT_WINDOW_CENTER
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .forEach(({ entry }) => {
        const task = this.#renderQueue.get(entry.target);
        if (task) {
          task();
          this.#renderQueue.delete(entry.target);
          this.#observer.unobserve(entry.target);
        }
      });
  }
}