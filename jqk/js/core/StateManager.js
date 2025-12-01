import { CONFIG } from "../config.js";
import { bboxToKey, isValidBbox, isRenderableType } from "../utils.js";

export class StateManager {
  constructor() {
    this.overlayData = new Map();
    this.activePalette = CONFIG.DEFAULT_PALETTE;
    this.globalCoordinateOrder = CONFIG.COORDINATES.DEFAULT_ORDER;
    this.pageOverrides = new Map();
  }

  initialize(json) {
    this.overlayData.clear();

    Object.entries(json).forEach(([pageKey, pageObj]) => {
      if (!pageObj?.blocks || !Array.isArray(pageObj.blocks)) return;

      const pageData = {
        width: pageObj.width || 1000,
        height: pageObj.height || 1000,
        blocks: new Map(),
      };

      pageObj.blocks.forEach((block) => {
        const { bbox, type, value } = block;
        if (!isValidBbox(bbox) || !isRenderableType(type)) return;

        pageData.blocks.set(bboxToKey(bbox), {
          bbox,
          type,
          text: this.#formatContent(value, type),
          fontSize: "auto",
          ...(type === CONFIG.CONTENT_TYPES.TABLE && { tableData: value }),
        });
      });

      this.overlayData.set(pageKey, pageData);
    });
  }

  #formatContent(value, type) {
    if (value == null || value === "") return "";
    switch (type) {
      case CONFIG.CONTENT_TYPES.LIST:
        return Array.isArray(value)
          ? value
              .map((l) => (String(l).startsWith("•") ? l : `• ${l}`))
              .join("\n")
          : String(value);
      case CONFIG.CONTENT_TYPES.TABLE:
        return Array.isArray(value) ? JSON.stringify(value) : String(value);
      default:
        return String(value).trim();
    }
  }

  getPageData(pageNum) {
    return this.overlayData.get(`page_${pageNum}`);
  }

  setGlobalCoordinateOrder(order) {
    this.globalCoordinateOrder = order;
  }

  getGlobalCoordinateOrder() {
    return this.globalCoordinateOrder;
  }

  getPageCoordinateOrder(pageNum) {
    return (
      this.pageOverrides.get(Number(pageNum)) || this.globalCoordinateOrder
    );
  }

  setPageCoordinateOrder(pageNum, order) {
    this.pageOverrides.set(Number(pageNum), order);
  }

  applyCoordinateOrderToAllPages(order) {
    this.overlayData.forEach((_, pageKey) => {
      this.pageOverrides.set(parseInt(pageKey.replace("page_", ""), 10), order);
    });
  }

  expandAllOverlays(amount) {
    this.overlayData.forEach((pageData) => {
      const expandedBlocks = new Map();
      pageData.blocks.forEach((data) => {
        const { bbox } = data;
        const expandedBbox = {
          top: bbox.top - amount,
          left: bbox.left - amount,
          bottom: bbox.bottom + amount,
          right: bbox.right + amount,
        };
        expandedBlocks.set(bboxToKey(expandedBbox), {
          ...data,
          bbox: expandedBbox,
        });
      });
      pageData.blocks = expandedBlocks;
    });
  }

  updateOverlayText(pageNum, key, text) {
    const blockData = this.getPageData(pageNum)?.blocks.get(key);
    if (!blockData) return;
    blockData.text = text;
    if (blockData.type === CONFIG.CONTENT_TYPES.TABLE) {
      try {
        blockData.tableData = JSON.parse(text);
      } catch {}
    }
  }

  deleteOverlay(pageNum, key) {
    this.getPageData(pageNum)?.blocks.delete(key);
  }

  getAllPageKeys() {
    return Array.from(this.overlayData.keys());
  }
}
