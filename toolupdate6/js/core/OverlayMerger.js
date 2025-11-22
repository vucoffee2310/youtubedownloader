import { CONFIG } from "../config.js";
import { parseCoords } from "../utils.js";

class MergePredicates {
  #nonMergeableTypes;
  constructor() {
    this.#nonMergeableTypes = new Set([
      CONFIG.CONTENT_TYPES.CODE,
      CONFIG.CONTENT_TYPES.TABLE,
      CONFIG.CONTENT_TYPES.IMAGE,
      CONFIG.CONTENT_TYPES.LIST,
    ]);
  }
  isMergeable(type) {
    return !this.#nonMergeableTypes.has(type);
  }
  hasSameType(dataA, dataB) {
    return dataA.type === dataB.type;
  }
  hasSameFontSize(dataA, dataB) {
    return dataA.fontSize === dataB.fontSize;
  }
  isHorizontallyAligned(coordsA, coordsB) {
    const [, leftA, , rightA] = coordsA;
    const [, leftB, , rightB] = coordsB;
    const tolerance = CONFIG.MERGE.TOLERANCE_HORIZONTAL;
    return (
      Math.abs(leftA - leftB) < tolerance &&
      Math.abs(rightA - rightB) < tolerance
    );
  }
  isVerticallyClose(coordsA, coordsB) {
    const [topA, , bottomA] = coordsA;
    const [topB] = coordsB;
    const gap = topB - bottomA;
    const dynamicTolerance =
      (bottomA - topA) * CONFIG.MERGE.TOLERANCE_VERTICAL_MULTIPLIER;
    return gap >= CONFIG.MERGE.MIN_GAP && gap < dynamicTolerance;
  }
  areCoordsValid(coords) {
    if (!Array.isArray(coords) || coords.length !== 4) return false;
    const [top, left, bottom, right] = coords;
    return left < right && top < bottom;
  }
  hasValidDimensions(coords) {
    const [top, left, bottom, right] = coords;
    const width = right - left;
    const height = bottom - top;
    return width > 0 && height > 0;
  }
}

export class OverlayMerger {
  #predicates;
  #coordCache;
  constructor() {
    this.#predicates = new MergePredicates();
    this.#coordCache = new Map();
  }
  canMerge(a, b) {
    if (!this.#predicates.isMergeable(a.data.type)) return false;
    if (!this.#predicates.hasSameType(a.data, b.data)) return false;
    if (!this.#predicates.hasSameFontSize(a.data, b.data)) return false;
    if (!this.#predicates.isHorizontallyAligned(a.coords, b.coords))
      return false;
    if (!this.#predicates.isVerticallyClose(a.coords, b.coords)) return false;
    return true;
  }
  mergePage(pageData, coordOrder) {
    console.log("🟢 OverlayMerger.mergePage() called");
    console.log("🟢 pageData type:", typeof pageData);
    console.log("🟢 pageData keys:", Object.keys(pageData || {}).length);
    if (!pageData || !Object.keys(pageData).length) {
      console.warn("⚠️ No page data to merge");
      return {};
    }
    const blocks = this.#parseBlocks(pageData, coordOrder);
    console.log("🟢 Parsed blocks:", blocks.length);
    if (!blocks.length) {
      console.warn("⚠️ No blocks parsed");
      return {};
    }
    const groups = this.#groupBlocks(blocks);
    console.log("🟢 Grouped into:", groups.length, "groups");
    const result = this.#buildMergedData(groups);
    console.log("🟢 Merge result:", Object.keys(result).length, "overlays");
    return result;
  }
  mergeAllPages(data, stateManager) {
    console.log("🟢 OverlayMerger.mergeAllPages() called");
    console.log(
      "🟢 Input data type:",
      data instanceof Map ? "Map" : typeof data
    );
    console.log(
      "🟢 Input data size/keys:",
      data instanceof Map ? data.size : Object.keys(data).length
    );
    const dataObj = data instanceof Map ? Object.fromEntries(data) : data;
    console.log("🟢 Converted to object with keys:", Object.keys(dataObj));
    const result = Object.fromEntries(
      Object.keys(dataObj).map((pageKey) => {
        const pageNum = pageKey.replace("page_", "");
        const coordOrder = stateManager.getPageCoordinateOrder(pageNum);
        const pageData = dataObj[pageKey];
        console.log(`🟢 Processing ${pageKey}`);
        console.log(
          `🟢 Page data type:`,
          pageData instanceof Map ? "Map" : typeof pageData
        );
        console.log(`🟢 Coordinate order: ${coordOrder}`);
        const pageDataObj =
          pageData instanceof Map ? Object.fromEntries(pageData) : pageData;
        console.log(
          `🟢 Converted page data, keys:`,
          Object.keys(pageDataObj || {}).length
        );
        const mergedData = this.mergePage(pageDataObj, coordOrder);
        console.log(
          `✅ ${pageKey} merged result:`,
          Object.keys(mergedData).length,
          "overlays"
        );
        return [pageKey, mergedData];
      })
    );
    console.log("✅ OverlayMerger.mergeAllPages() complete");
    console.log("✅ Total pages in result:", Object.keys(result).length);
    return result;
  }
  clearCache() {
    this.#coordCache.clear();
  }
  #parseBlocks(pageData, coordOrder) {
    return Object.entries(pageData)
      .map(([key, data]) => ({
        key,
        coords: this.#getCachedCoords(key, coordOrder),
        data,
      }))
      .filter((block) => block.coords.length === 4)
      .sort((a, b) => a.coords[0] - b.coords[0] || a.coords[1] - b.coords[1]);
  }
  #getCachedCoords(key, coordOrder) {
    const cacheKey = `${key}:${coordOrder}`;
    if (this.#coordCache.has(cacheKey)) {
      return this.#coordCache.get(cacheKey);
    }
    const coords = parseCoords(key, coordOrder);
    if (this.#coordCache.size >= CONFIG.CACHE.MAX_PAGE_CACHE) {
      const firstKey = this.#coordCache.keys().next().value;
      this.#coordCache.delete(firstKey);
    }
    this.#coordCache.set(cacheKey, coords);
    return coords;
  }
  #groupBlocks(blocks) {
    return blocks.reduce((groups, block) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && this.canMerge(lastGroup[lastGroup.length - 1], block)) {
        lastGroup.push(block);
      } else {
        groups.push([block]);
      }
      return groups;
    }, []);
  }
  #buildMergedData(groups) {
    return groups.reduce((result, group) => {
      if (group.length === 1) {
        result[group[0].key] = group[0].data;
      } else {
        const mergedEntry = this.#mergeGroup(group);
        result[mergedEntry.key] = mergedEntry.data;
      }
      return result;
    }, {});
  }
  #mergeGroup(group) {
    const first = group[0];
    const last = group[group.length - 1];
    const mergedKey = JSON.stringify([
      first.coords[0],
      first.coords[1],
      last.coords[2],
      first.coords[3],
    ]);
    const mergedText = group
      .map((block) => `<div class="merged-text-block">${block.data.text}</div>`)
      .join("");
    return {
      key: mergedKey,
      data: {
        ...first.data,
        text: mergedText,
      },
    };
  }
}
