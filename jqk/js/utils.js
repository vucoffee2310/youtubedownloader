import { CONFIG } from "./config.js";
export class LRUCache {
  #cache;
  #maxSize;
  constructor(maxSize = 100) {
    this.#cache = new Map();
    this.#maxSize = maxSize;
  }
  get(key) {
    if (!this.#cache.has(key)) return undefined;
    const value = this.#cache.get(key);
    this.#cache.delete(key);
    this.#cache.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.#cache.has(key)) {
      this.#cache.delete(key);
    } else if (this.#cache.size >= this.#maxSize) {
      this.#cache.delete(this.#cache.keys().next().value);
    }
    this.#cache.set(key, value);
  }
  has(key) {
    return this.#cache.has(key);
  }
  clear() {
    this.#cache.clear();
  }
}
export const debounce = (fn, delay = CONFIG.UI.DEBOUNCE_DELAY) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
export const forceUIUpdate = () =>
  new Promise((r) =>
    requestAnimationFrame(() => setTimeout(r, CONFIG.RENDER.BATCH_DELAY))
  );
export const createButtonHandler = (btn, asyncFn) => async () => {
  if (btn.disabled) return;
  btn.disabled = true;
  btn.classList.add("loading");
  await forceUIUpdate();
  try {
    return await asyncFn();
  } finally {
    btn.disabled = false;
    btn.classList.remove("loading");
  }
};
export const withErrorHandling = async (fn, msg = "Operation failed") => {
  try {
    return await fn();
  } catch (error) {
    console.error(`${msg}:`, error);
    alert(`${msg}: ${error.message}`);
    throw error;
  }
};
export const bboxToKey = (bbox) =>
  bbox ? `${bbox.top},${bbox.left},${bbox.bottom},${bbox.right}` : "0,0,0,0";
export const keyToBbox = (key) => {
  if (!key) return { top: 0, left: 0, bottom: 0, right: 0 };
  const [top, left, bottom, right] = key.split(",").map(Number);
  return { top, left, bottom, right };
};
export const box2dToBbox = (box_2d) => {
  if (!box_2d || !Array.isArray(box_2d) || box_2d.length !== 4) return null;
  return {
    top: box_2d[0],
    left: box_2d[1],
    bottom: box_2d[2],
    right: box_2d[3]
  };
};
export const bboxToOrderedCoords = (
  bbox,
  order = CONFIG.COORDINATES.DEFAULT_ORDER
) => {
  const tlbr = [bbox.top, bbox.left, bbox.bottom, bbox.right];
  return order.split("").map((letter) => tlbr[CONFIG.COORDINATES.MAP[letter]]);
};
export const isValidBbox = (bbox) => {
  if (!bbox || typeof bbox !== "object") return false;
  const { top, left, bottom, right } = bbox;
  return (
    [top, left, bottom, right].every(
      (v) => typeof v === "number" && !isNaN(v)
    ) &&
    left < right &&
    top < bottom
  );
};
export const calculateOverlayPosition = ({
  bbox,
  pdfWidth,
  pdfHeight,
  containerWidth,
  containerHeight,
  minHeight = CONFIG.OVERLAY.MIN_HEIGHT,
}) => {
  const { top, left, bottom, right } = bbox;
  if (top < 0 || left < 0 || bottom <= top || right <= left) {
    return { left: 0, top: 0, width: 100, height: minHeight };
  }
  const scaleX = containerWidth / 1000
  const scaleY = containerHeight / 1000
  return {
    left: Math.max(0, left * scaleX),
    top: Math.max(0, top * scaleY),
    width: Math.max(1, (right - left) * scaleX),
    height: Math.max(minHeight, (bottom - top) * scaleY),
  };
};
export const isRenderableType = (type) =>
  type !== CONFIG.CONTENT_TYPES.IMAGE && type !== CONFIG.CONTENT_TYPES.CODE;
export const checkOverflow = (
  el,
  tolerance = CONFIG.OVERLAY.OVERFLOW_TOLERANCE
) =>
  el.scrollHeight > el.clientHeight + tolerance ||
  el.scrollWidth > el.clientWidth + tolerance;
export const toPx = (value) => `${value}px`;
export const escapeHtml = (str) => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};
export const createElementFromHTML = (html) => {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
};
export const readFile = (file, method) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(reader.error);
    reader[method](file);
  });
export const parsePageSpec = (spec, maxPage = Infinity) => {
  if (!spec || typeof spec !== "string") return [];
  const pages = new Set();
  spec.split(",").forEach((part) => {
    part = part.trim();
    if (part.includes("-")) {
      const [start, end] = part.split("-").map((s) => parseInt(s.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++)
          pages.add(i);
      }
    } else {
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPage) pages.add(page);
    }
  });
  return Array.from(pages).sort((a, b) => a - b);
};
export const formatPageList = (pages, max = 10) => {
  if (!pages.length) return "none";
  if (pages.length <= max) return pages.join(", ");
  return `${pages.slice(0, max).join(", ")} ... (+${pages.length - max} more)`;
};
export const validateRange = (start, end, max) => {
  if (start < 1 || end < 1)
    return { valid: false, error: CONFIG.MESSAGES.RANGE_ERROR_POSITIVE };
  if (start > end)
    return { valid: false, error: CONFIG.MESSAGES.RANGE_ERROR_ORDER };
  if (end > max)
    return {
      valid: false,
      error: CONFIG.MESSAGES.RANGE_ERROR_EXCEEDS.replace("{max}", max),
    };
  return { valid: true };
};
export const formatMessage = (template, values) => {
  let result = template;
  Object.entries(values).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return result;
};
export const padNumber = (num, length = CONFIG.EXPORT.FILENAME_PADDING) =>
  String(num).padStart(length, "0");
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const calculateBrightness = (r, g, b) =>
  (r * 0.299 + g * 0.587 + b * 0.114) / 255;
export const rgbToString = (r, g, b, a = 1) =>
  a === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
export const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size)
    chunks.push(array.slice(i, i + size));
  return chunks;
};