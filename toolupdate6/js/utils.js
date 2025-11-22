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
      const firstKey = this.#cache.keys().next().value;
      this.#cache.delete(firstKey);
    }
    this.#cache.set(key, value);
  }
  has(key) {
    return this.#cache.has(key);
  }
  delete(key) {
    return this.#cache.delete(key);
  }
  clear() {
    this.#cache.clear();
  }
  size() {
    return this.#cache.size;
  }
  keys() {
    return Array.from(this.#cache.keys());
  }
  values() {
    return Array.from(this.#cache.values());
  }
}
export const debounce = (fn, delay = CONFIG.UI.DEBOUNCE_DELAY) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};
export const throttle = (fn, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};
export const measureTime = (fn, label = "Function") => {
  return async (...args) => {
    const start = performance.now();
    const result = await fn(...args);
    const end = performance.now();
    console.log(`${label} took ${(end - start).toFixed(2)}ms`);
    return result;
  };
};
export const forceUIUpdate = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, CONFIG.RENDER.BATCH_DELAY));
  });
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
export const parseCoords = (str, order = CONFIG.COORDINATES.DEFAULT_ORDER) => {
  try {
    const raw = JSON.parse(str);
    if (!Array.isArray(raw) || raw.length !== 4) return [0, 0, 0, 0];
    return order.split("").map((letter) => raw[CONFIG.COORDINATES.MAP[letter]]);
  } catch {
    return [0, 0, 0, 0];
  }
};
export const coordinatesToOrder = (
  tlbr,
  order = CONFIG.COORDINATES.DEFAULT_ORDER
) => order.split("").map((letter) => tlbr[CONFIG.COORDINATES.MAP[letter]]);
export const calculateOverlayPosition = ({
  coords,
  containerWidth,
  containerHeight,
  minHeight = CONFIG.OVERLAY.MIN_HEIGHT,
  coordOrder,
}) => {
  const [top, left, bottom, right] = parseCoords(coords, coordOrder);
  if (top < 0 || left < 0 || bottom <= top || right <= left) {
    return { left: 0, top: 0, width: 100, height: minHeight };
  }
  const sx = containerWidth / 1000;
  const sy = containerHeight / 1000;
  return {
    left: Math.max(0, left * sx),
    top: Math.max(0, top * sy),
    width: Math.max(1, (right - left) * sx),
    height: Math.max(minHeight, (bottom - top) * sy),
  };
};
export const isValidBbox = (bbox) => {
  if (!Array.isArray(bbox) || bbox.length !== 4) return false;
  const [top, left, bottom, right] = bbox;
  return (
    left < right &&
    top < bottom &&
    bbox.every((val) => typeof val === "number" && !isNaN(val))
  );
};
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
export const safeQuerySelector = (selector, parent = document) => {
  const element = parent.querySelector(selector);
  if (!element) console.warn(`Element not found: ${selector}`);
  return element;
};
export const safeQuerySelectorAll = (selector, parent = document) =>
  Array.from(parent.querySelectorAll(selector));
export const getComputedStyleValue = (element, property) =>
  getComputedStyle(element).getPropertyValue(property);
export const setStyles = (element, styles) => {
  Object.entries(styles).forEach(([property, value]) => {
    element.style[property] = value;
  });
};
export const toggleClass = (element, className, force) => {
  if (force !== undefined) {
    element.classList.toggle(className, force);
  } else {
    element.classList.toggle(className);
  }
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
        for (
          let i = Math.max(CONFIG.VALIDATION.MIN_PAGE, start);
          i <= Math.min(maxPage, end);
          i++
        ) {
          pages.add(i);
        }
      }
    } else {
      const page = parseInt(part, 10);
      if (
        !isNaN(page) &&
        page >= CONFIG.VALIDATION.MIN_PAGE &&
        page <= maxPage
      ) {
        pages.add(page);
      }
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
  if (start < CONFIG.VALIDATION.MIN_PAGE || end < CONFIG.VALIDATION.MIN_PAGE) {
    return { valid: false, error: CONFIG.MESSAGES.RANGE_ERROR_POSITIVE };
  }
  if (start > end) {
    return { valid: false, error: CONFIG.MESSAGES.RANGE_ERROR_ORDER };
  }
  if (end > max) {
    return {
      valid: false,
      error: CONFIG.MESSAGES.RANGE_ERROR_EXCEEDS.replace("{max}", max),
    };
  }
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
export const parseRGBA = (str) => {
  const matches = str?.match(/(\d+(\.\d+)?)/g) || [];
  const values = matches.map(Number);
  while (values.length < 3) values.push(0);
  if (values.length === 3) values.push(1.0);
  return values.slice(0, 4);
};
export const parseFontSize = (fontSize) => {
  const parsed = parseFloat(fontSize);
  return isNaN(parsed) ? CONFIG.OVERLAY.MIN_FONT_SIZE : parsed;
};
export const getFontStyle = (weight, style) => {
  const bold = weight === "bold" || Number(weight) >= 700;
  const italic = style === "italic" || style === "oblique";
  if (bold && italic) return "bolditalic";
  if (bold) return "bold";
  if (italic) return "italic";
  return "normal";
};
export const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};
export const unique = (array) => [...new Set(array)];
export const groupBy = (array, keyFn) => {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {});
};
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof Array) return obj.map((item) => deepClone(item));
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) cloned[key] = deepClone(obj[key]);
  }
  return cloned;
};
export const isEmpty = (obj) => {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === "string") return obj.length === 0;
  return Object.keys(obj).length === 0;
};
export const pick = (obj, keys) => {
  return keys.reduce((result, key) => {
    if (key in obj) result[key] = obj[key];
    return result;
  }, {});
};
export const omit = (obj, keys) => {
  const omitSet = new Set(keys);
  return Object.keys(obj).reduce((result, key) => {
    if (!omitSet.has(key)) result[key] = obj[key];
    return result;
  }, {});
};
export const isNumber = (value) => typeof value === "number" && !isNaN(value);
export const isString = (value) =>
  typeof value === "string" && value.length > 0;
export const isFunction = (value) => typeof value === "function";
export const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
