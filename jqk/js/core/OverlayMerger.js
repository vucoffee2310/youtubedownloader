import { CONFIG } from "../config.js";
import { bboxToKey, bboxToOrderedCoords } from "../utils.js";

const NON_MERGEABLE = new Set([
  CONFIG.CONTENT_TYPES.TABLE,
  CONFIG.CONTENT_TYPES.LIST,
]);

const canMerge = (a, b) => {
  if (NON_MERGEABLE.has(a.data.type)) return false;
  if (a.data.type !== b.data.type || a.data.fontSize !== b.data.fontSize)
    return false;

  const [topA, leftA, bottomA, rightA] = a.coords;
  const [topB, leftB, , rightB] = b.coords;
  const tolerance = CONFIG.MERGE.TOLERANCE_HORIZONTAL;

  if (
    Math.abs(leftA - leftB) >= tolerance ||
    Math.abs(rightA - rightB) >= tolerance
  )
    return false;

  const gap = topB - bottomA;
  const dynamicTolerance =
    (bottomA - topA) * CONFIG.MERGE.TOLERANCE_VERTICAL_MULTIPLIER;
  return gap >= CONFIG.MERGE.MIN_GAP && gap < dynamicTolerance;
};

export class OverlayMerger {
  #coordCache = new Map();

  mergePage(pageData, coordOrder) {
    if (!pageData?.blocks?.size) return new Map();

    const blockArray = Array.from(pageData.blocks.entries())
      .map(([key, data]) => ({
        key,
        bbox: data.bbox,
        coords: this.#getCoords(data.bbox, coordOrder),
        data,
      }))
      .filter((b) => b.coords.length === 4)
      .sort((a, b) => a.coords[0] - b.coords[0] || a.coords[1] - b.coords[1]);

    if (!blockArray.length) return new Map();

    const groups = blockArray.reduce((acc, block) => {
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && canMerge(lastGroup[lastGroup.length - 1], block)) {
        lastGroup.push(block);
      } else {
        acc.push([block]);
      }
      return acc;
    }, []);

    const result = new Map();
    groups.forEach((group) => {
      if (group.length === 1) {
        result.set(group[0].key, group[0].data);
      } else {
        const first = group[0],
          last = group[group.length - 1];
        const mergedBbox = {
          top: first.bbox.top,
          left: first.bbox.left,
          bottom: last.bbox.bottom,
          right: first.bbox.right,
        };
        result.set(bboxToKey(mergedBbox), {
          ...first.data,
          bbox: mergedBbox,
          text: group
            .map((b) => `<div class="merged-text-block">${b.data.text}</div>`)
            .join(""),
        });
      }
    });

    return result;
  }

  clearCache() {
    this.#coordCache.clear();
  }

  #getCoords(bbox, coordOrder) {
    const cacheKey = `${bboxToKey(bbox)}:${coordOrder}`;
    if (this.#coordCache.has(cacheKey)) return this.#coordCache.get(cacheKey);

    const coords = bboxToOrderedCoords(bbox, coordOrder);
    if (this.#coordCache.size >= CONFIG.CACHE.MAX_PAGE_CACHE) {
      this.#coordCache.delete(this.#coordCache.keys().next().value);
    }
    this.#coordCache.set(cacheKey, coords);
    return coords;
  }
}
