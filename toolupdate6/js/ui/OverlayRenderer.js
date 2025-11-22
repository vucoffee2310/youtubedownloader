import { CONFIG } from "../config.js";
import { calculateOverlayPosition, toPx, debounce } from "../utils.js";
import { ContentRenderer } from "../renderers/ContentFormatters.js";

class OverlayFactory {
  #state;
  #contentRenderer;
  #fontCalc;
  constructor(state, contentRenderer, fontCalc) {
    this.#state = state;
    this.#contentRenderer = contentRenderer;
    this.#fontCalc = fontCalc;
  }
  create({ coords, info, pageNum, dimensions, coordOrder }) {
    const position = calculateOverlayPosition({
      coords,
      containerWidth: dimensions.width,
      containerHeight: dimensions.height,
      minHeight: CONFIG.OVERLAY.MIN_HEIGHT,
      coordOrder,
    });
    const type = info.type || CONFIG.CONTENT_TYPES.TEXT;
    const overlay = this.#createOverlayElement(
      coords,
      info,
      pageNum,
      position,
      type
    );
    const textElement = this.#createTextElement(info, position);
    const deleteButton = this.#createDeleteButton();
    overlay.append(textElement, deleteButton);
    return overlay;
  }
  #createOverlayElement(coords, info, pageNum, position, type) {
    const isVertical = this.#isVerticalText(type, position);
    const isSingleLine = this.#isSingleLineText(type, info.text);
    const overlay = document.createElement("div");
    Object.assign(overlay.dataset, {
      coords,
      pageNum,
      targetHeight: position.height,
      contentType: type,
    });
    overlay.className = [
      "overlay",
      `content-${type}`,
      isVertical ? "vertical-text" : "",
      isSingleLine ? "single-line-layout" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const height =
      type === CONFIG.CONTENT_TYPES.TABLE
        ? toPx(position.height)
        : "fit-content";
    overlay.style.cssText = `
      left: ${toPx(position.left)};
      top: ${toPx(position.top)};
      width: ${toPx(position.width)};
      height: ${height}
    `;
    return overlay;
  }
  #createTextElement(info, position) {
    const textElement = document.createElement("div");
    textElement.className = "overlay-text";
    textElement.contentEditable = info.type !== CONFIG.CONTENT_TYPES.IMAGE;
    textElement.innerHTML = this.#contentRenderer.formatContent(info);
    textElement.addEventListener(
      "blur",
      debounce((e) => {
        this.#handleTextUpdate(e);
      }, CONFIG.UI.DEBOUNCE_TEXT)
    );
    return textElement;
  }
  #createDeleteButton() {
    const button = document.createElement("button");
    button.className = "delete-overlay-btn";
    button.innerHTML = "&times;";
    button.title = "Delete this overlay";
    button.addEventListener("click", (e) => {
      const overlay = e.target.closest(".overlay");
      if (overlay && confirm(CONFIG.MESSAGES.DELETE_CONFIRM)) {
        this.#state.deleteOverlay(
          overlay.dataset.pageNum,
          overlay.dataset.coords
        );
        overlay.remove();
      }
    });
    return button;
  }
  #handleTextUpdate(event) {
    const overlay = event.target.closest(".overlay");
    if (!overlay) return;
    const type = overlay.dataset.contentType;
    let value;
    if (type === CONFIG.CONTENT_TYPES.TABLE) {
      value = this.#contentRenderer.extractTableToJSON(event.target);
    } else if (type === CONFIG.CONTENT_TYPES.CODE) {
      value = event.target.textContent;
    } else if (event.target.querySelector(".merged-text-block")) {
      value = event.target.innerHTML;
    } else {
      value = event.target.innerText;
    }
    this.#state.updateOverlayText(
      overlay.dataset.pageNum,
      overlay.dataset.coords,
      value
    );
    if (
      [
        CONFIG.CONTENT_TYPES.TEXT,
        CONFIG.CONTENT_TYPES.LIST,
        CONFIG.CONTENT_TYPES.CODE,
        CONFIG.CONTENT_TYPES.TABLE,
      ].includes(type)
    ) {
      this.#fontCalc.calculateOptimalSize(overlay);
    }
  }
  #isVerticalText(type, position) {
    return (
      type === CONFIG.CONTENT_TYPES.TEXT &&
      position.width > 0 &&
      position.height / position.width > CONFIG.OVERLAY.VERTICAL_THRESHOLD
    );
  }
  #isSingleLineText(type, text) {
    return (
      type === CONFIG.CONTENT_TYPES.TEXT &&
      !text.includes("<div") &&
      !text.includes("\n")
    );
  }
}

export class OverlayRenderer {
  #state;
  #fontCalc;
  #contentRenderer;
  #factory;
  constructor(state, fontCalc) {
    this.#state = state;
    this.#fontCalc = fontCalc;
    this.#contentRenderer = new ContentRenderer();
    this.#factory = new OverlayFactory(state, this.#contentRenderer, fontCalc);
  }
  renderPageOverlays(wrapper, pageNum, dimensions, mergedData) {
    console.log(`🟣 OverlayRenderer.renderPageOverlays() for page ${pageNum}`);
    console.log(`🟣 Dimensions:`, dimensions);
    console.log(`🟣 MergedData:`, mergedData);
    const pageData = mergedData[`page_${pageNum}`];
    console.log(`🟣 Page data for page_${pageNum}:`, pageData);
    console.log(
      `🟣 Page data keys:`,
      pageData ? Object.keys(pageData).length : 0
    );
    if (!pageData) {
      console.warn(`⚠️ No page data found for page_${pageNum}`);
      console.warn(`⚠️ Available keys in mergedData:`, Object.keys(mergedData));
      return;
    }
    this.#clearExistingOverlays(wrapper);
    const coordOrder = this.#state.getPageCoordinateOrder(pageNum);
    console.log(`🟣 Coordinate order for page ${pageNum}:`, coordOrder);
    const fragment = document.createDocumentFragment();
    const overlaysToOptimize = [];
    let overlayCount = 0;
    Object.entries(pageData).forEach(([coords, info]) => {
      console.log(`🟣 Creating overlay ${overlayCount}:`, {
        coords: coords.substring(0, 30) + "...",
        type: info.type,
        text: info.text?.substring(0, 50) + "...",
      });
      const overlay = this.#factory.create({
        coords,
        info,
        pageNum,
        dimensions,
        coordOrder,
      });
      fragment.appendChild(overlay);
      if (this.#shouldOptimize(info.type)) {
        overlaysToOptimize.push(overlay);
      }
      overlayCount++;
    });
    console.log(`✅ Created ${overlayCount} overlays for page ${pageNum}`);
    wrapper.appendChild(fragment);
    requestAnimationFrame(() => {
      overlaysToOptimize.forEach((overlay) =>
        this.#fontCalc.calculateOptimalSize(overlay)
      );
      console.log(
        `✅ Optimized ${overlaysToOptimize.length} overlays for page ${pageNum}`
      );
    });
  }
  #clearExistingOverlays(wrapper) {
    wrapper.querySelectorAll(".overlay").forEach((el) => el.remove());
  }
  #shouldOptimize(type) {
    return [
      CONFIG.CONTENT_TYPES.TEXT,
      CONFIG.CONTENT_TYPES.LIST,
      CONFIG.CONTENT_TYPES.CODE,
      CONFIG.CONTENT_TYPES.TABLE,
    ].includes(type);
  }
}
