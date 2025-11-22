import { CONFIG } from "../config.js";
import { checkOverflow, toPx } from "../utils.js";
import { TableLayout } from "./TableLayoutEngine.js";
import { LRUCache } from "../utils.js";

export class FontSizeCalculator {
  #cache;
  #tableLayout;
  constructor() {
    this.#cache = new LRUCache(CONFIG.CACHE.MAX_FONT_SIZE_CACHE);
    this.#tableLayout = new TableLayout();
  }
  clearCache() {
    this.#cache.clear();
    this.#tableLayout.clearCache();
  }
  calculateOptimalSize(overlay) {
    const type = overlay.dataset.contentType;
    if (type === CONFIG.CONTENT_TYPES.TABLE) {
      return this.#tableLayout.optimizeTable(overlay);
    }
    const textElement = overlay.querySelector(".overlay-text");
    if (!textElement?.innerHTML.trim()) return;
    const dimensions = this.#getOverlayDimensions(overlay);
    if (!this.#isValidDimensions(dimensions)) return;
    const cacheKey = this.#generateCacheKey(dimensions, textElement);
    const cachedSize = this.#cache.get(cacheKey);
    if (cachedSize) {
      this.#applyFontSize(overlay, cachedSize);
      return;
    }
    const fontSize = this.#calculateSize(textElement, overlay, dimensions);
    this.#cache.set(cacheKey, fontSize);
    this.#applyFontSize(overlay, fontSize);
  }
  #getOverlayDimensions(overlay) {
    return {
      width: overlay.clientWidth,
      height: parseFloat(overlay.dataset.targetHeight) || overlay.clientHeight,
    };
  }
  #isValidDimensions({ width, height }) {
    return width > 0 && height > 0;
  }
  #generateCacheKey({ width, height }, textElement) {
    return `${width | 0}x${height | 0}:${textElement.innerHTML.length}`;
  }
  #applyFontSize(overlay, size) {
    overlay.style.fontSize = toPx(size);
    overlay.offsetHeight;
  }
  #calculateSize(textElement, container, { width, height }) {
    const previousHeight = container.style.height;
    container.style.height = toPx(height);
    container.offsetHeight;
    const fontSize = this.#fitTextToContainer(
      textElement,
      container,
      width,
      height
    );
    container.style.height = previousHeight;
    container.offsetHeight;
    return fontSize;
  }
  #fitTextToContainer(textElement, container, width, height) {
    const textLength = textElement.textContent.length || 1;
    const initialGuess = this.#calculateInitialGuess(width, height, textLength);
    textElement.style.fontSize = toPx(initialGuess);
    textElement.offsetHeight;
    if (!checkOverflow(container, CONFIG.OVERLAY.OVERFLOW_TOLERANCE)) {
      return this.#tryUpscale(textElement, container, initialGuess);
    }
    return this.#binarySearchFontSize(
      textElement,
      container,
      CONFIG.OVERLAY.MIN_FONT_SIZE,
      initialGuess
    );
  }
  #calculateInitialGuess(width, height, textLength) {
    const area = width * height;
    const guess =
      Math.sqrt(area / textLength) * CONFIG.OVERLAY.FONT_SIZE_GUESS_MULTIPLIER;
    return Math.max(
      CONFIG.OVERLAY.MIN_FONT_SIZE,
      Math.min(CONFIG.OVERLAY.MAX_FONT_SIZE, guess)
    );
  }
  #tryUpscale(textElement, container, currentSize) {
    const upscaledSize = Math.min(
      CONFIG.OVERLAY.MAX_FONT_SIZE,
      currentSize * CONFIG.OVERLAY.FONT_SIZE_UPSCALE_MULTIPLIER
    );
    textElement.style.fontSize = toPx(upscaledSize);
    textElement.offsetHeight;
    if (checkOverflow(container, CONFIG.OVERLAY.OVERFLOW_TOLERANCE)) {
      return this.#binarySearchFontSize(
        textElement,
        container,
        currentSize,
        upscaledSize
      );
    }
    return upscaledSize;
  }
  #binarySearchFontSize(textElement, container, minSize, maxSize) {
    let low = minSize;
    let high = maxSize;
    let bestSize = low;
    for (
      let iteration = 0;
      iteration < CONFIG.OVERLAY.BINARY_SEARCH_ITERATIONS &&
      high - low > CONFIG.OVERLAY.BINARY_SEARCH_PRECISION;
      iteration++
    ) {
      const mid = (low + high) / 2;
      textElement.style.fontSize = toPx(mid);
      textElement.offsetHeight;
      if (checkOverflow(container, CONFIG.OVERLAY.OVERFLOW_TOLERANCE)) {
        high = mid;
      } else {
        bestSize = mid;
        low = mid;
      }
    }
    textElement.style.fontSize = "";
    return bestSize;
  }
}
