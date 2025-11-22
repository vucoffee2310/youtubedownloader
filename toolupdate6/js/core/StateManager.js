import { CONFIG } from "../config.js";
import { parseCoords, coordinatesToOrder, isValidBbox } from "../utils.js";

class ContentFormatter {
  format(content, type) {
    if (!content && type !== CONFIG.CONTENT_TYPES.IMAGE) return "";
    const formatters = {
      [CONFIG.CONTENT_TYPES.CODE]: () => this._formatCode(content),
      [CONFIG.CONTENT_TYPES.LIST]: () => this._formatList(content),
      [CONFIG.CONTENT_TYPES.TABLE]: () => this._formatTable(content),
      [CONFIG.CONTENT_TYPES.IMAGE]: () => "[Image]",
      [CONFIG.CONTENT_TYPES.TEXT]: () => this._formatText(content),
    };
    return (formatters[type] || formatters[CONFIG.CONTENT_TYPES.TEXT])();
  }
  _formatCode(content) {
    return String(content).trimEnd();
  }
  _formatList(content) {
    if (!Array.isArray(content)) return String(content);
    return content
      .map((line) => {
        const str = String(line).trim();
        return str.startsWith("•") ? str : `• ${str}`;
      })
      .join("\n");
  }
  _formatTable(content) {
    if (!Array.isArray(content)) return String(content || "");
    return JSON.stringify(content);
  }
  _formatText(content) {
    return String(content).trim();
  }
  extractType(item, bboxKey) {
    const typeKey = Object.keys(item).find((k) => k !== bboxKey);
    if (!typeKey) return CONFIG.CONTENT_TYPES.TEXT;
    const typeMap = {
      text: CONFIG.CONTENT_TYPES.TEXT,
      code: CONFIG.CONTENT_TYPES.CODE,
      list: CONFIG.CONTENT_TYPES.LIST,
      table: CONFIG.CONTENT_TYPES.TABLE,
      image: CONFIG.CONTENT_TYPES.IMAGE,
    };
    return typeMap[typeKey] || CONFIG.CONTENT_TYPES.TEXT;
  }
}

export class StateManager {
  constructor() {
    this.overlayData = new Map();
    this.activePalette = CONFIG.DEFAULT_PALETTE;
    this.globalCoordinateOrder = CONFIG.COORDINATES.DEFAULT_ORDER;
    this.pageOverrides = new Map();
    this.formatter = new ContentFormatter();
  }
  initialize(json) {
    console.log("🔵 StateManager.initialize() called with:", json);
    this.overlayData.clear();
    const bboxKey = "[y1, x1, y2, x2]";
    Object.entries(json).forEach(([pageKey, items]) => {
      console.log(`🔵 Processing ${pageKey}:`, items);
      if (!Array.isArray(items)) {
        console.warn(`⚠️ ${pageKey} items is not an array:`, items);
        return;
      }
      const pageData = new Map();
      items.forEach((item, index) => {
        const bbox = item[bboxKey];
        if (!isValidBbox(bbox)) {
          console.warn(`⚠️ Invalid bbox for ${pageKey} item ${index}:`, bbox);
          return;
        }
        const { type, content } = this._extractContent(item, bboxKey);
        console.log(`✅ Extracted ${pageKey} item ${index}:`, {
          type,
          content: content?.toString().substring(0, 50) + "...",
        });
        if (!content && type !== CONFIG.CONTENT_TYPES.IMAGE) {
          console.warn(`⚠️ No content for ${pageKey} item ${index}`);
          return;
        }
        const key = JSON.stringify(bbox);
        pageData.set(key, {
          text: this.formatter.format(content, type),
          fontSize: "auto",
          type,
          originalBbox: bbox,
          ...(type === CONFIG.CONTENT_TYPES.TABLE && { tableData: content }),
        });
      });
      console.log(`✅ ${pageKey} stored ${pageData.size} overlays`);
      this.overlayData.set(pageKey, pageData);
    });
    console.log(
      "✅ StateManager.initialize() complete. Total pages:",
      this.overlayData.size
    );
    console.log("✅ overlayData Map:", this.overlayData);
    this._dispatchStateChange("initialized");
  }
  _extractContent(item, bboxKey) {
    const typeKey = Object.keys(item).find((k) => k !== bboxKey);
    if (!typeKey) return { type: CONFIG.CONTENT_TYPES.TEXT, content: "" };
    const typeMap = {
      text: CONFIG.CONTENT_TYPES.TEXT,
      code: CONFIG.CONTENT_TYPES.CODE,
      list: CONFIG.CONTENT_TYPES.LIST,
      table: CONFIG.CONTENT_TYPES.TABLE,
      image: CONFIG.CONTENT_TYPES.IMAGE,
    };
    return {
      type: typeMap[typeKey] || CONFIG.CONTENT_TYPES.TEXT,
      content: item[typeKey],
    };
  }
  setGlobalCoordinateOrder(order) {
    this.globalCoordinateOrder = order;
    this._dispatchStateChange("globalCoordinateOrderChanged", { order });
  }
  getGlobalCoordinateOrder() {
    return this.globalCoordinateOrder;
  }
  getPageCoordinateOrder(pageNum) {
    return this.pageOverrides.get(pageNum) || this.globalCoordinateOrder;
  }
  setPageCoordinateOrder(pageNum, order) {
    this.pageOverrides.set(pageNum, order);
    this._dispatchStateChange("pageCoordinateOrderChanged", { pageNum, order });
  }
  applyCoordinateOrderToAllPages(order) {
    this.overlayData.forEach((_, pageKey) => {
      const pageNum = pageKey.replace("page_", "");
      this.pageOverrides.set(pageNum, order);
    });
    this._dispatchStateChange("allPagesCoordinateOrderChanged", { order });
  }
  expandAllOverlays(amount) {
    this.overlayData.forEach((pageData, pageKey) => {
      const pageNum = pageKey.replace("page_", "");
      const coordOrder = this.getPageCoordinateOrder(pageNum);
      const expandedData = new Map();
      pageData.forEach((data, coords) => {
        const [top, left, bottom, right] = parseCoords(coords, coordOrder);
        const expandedTLBR = [
          top - amount,
          left - amount,
          bottom + amount,
          right + amount,
        ];
        const expandedCoords = coordinatesToOrder(expandedTLBR, coordOrder);
        expandedData.set(JSON.stringify(expandedCoords), data);
      });
      this.overlayData.set(pageKey, expandedData);
    });
    this._dispatchStateChange("overlaysExpanded", { amount });
  }
  updateOverlayText(pageNum, coords, text) {
    const pageKey = `page_${pageNum}`;
    const pageData = this.overlayData.get(pageKey);
    if (pageData?.has(coords)) {
      const overlay = pageData.get(coords);
      overlay.text = text;
      if (overlay.type === CONFIG.CONTENT_TYPES.TABLE) {
        try {
          overlay.tableData = JSON.parse(text);
        } catch (e) {
          console.warn("Failed to parse table data:", e);
        }
      }
      this._dispatchStateChange("overlayTextUpdated", { pageNum, coords });
    }
  }
  deleteOverlay(pageNum, coords) {
    const pageKey = `page_${pageNum}`;
    const pageData = this.overlayData.get(pageKey);
    if (pageData?.has(coords)) {
      pageData.delete(coords);
      this._dispatchStateChange("overlayDeleted", { pageNum, coords });
    }
  }
  getPageData(pageNum) {
    return this.overlayData.get(`page_${pageNum}`);
  }
  getAllPageKeys() {
    return Array.from(this.overlayData.keys());
  }
  toJSON() {
    const result = {};
    this.overlayData.forEach((pageData, pageKey) => {
      result[pageKey] = Object.fromEntries(pageData);
    });
    return result;
  }
  _dispatchStateChange(type, detail = {}) {
    document.dispatchEvent(
      new CustomEvent("stateChange", {
        detail: { type, ...detail },
      })
    );
  }
}
