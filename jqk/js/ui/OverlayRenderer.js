import { CONFIG } from "../config.js";
import {
  calculateOverlayPosition,
  toPx,
  debounce,
  isRenderableType,
} from "../utils.js";
import {
  formatContent,
  extractTableToJSON,
} from "../renderers/ContentFormatters.js";

class OverlayFactory {
  #state;
  #fontCalc;

  constructor(state, fontCalc) {
    this.#state = state;
    this.#fontCalc = fontCalc;
  }

  create({ key, bbox, info, pageNum, containerDimensions, pdfDimensions }) {
    const position = calculateOverlayPosition({
      bbox,
      pdfWidth: pdfDimensions.width,
      pdfHeight: pdfDimensions.height,
      containerWidth: containerDimensions.width,
      containerHeight: containerDimensions.height,
    });

    const type = info.type || CONFIG.CONTENT_TYPES.TEXT;
    const isSingleLine =
      type === CONFIG.CONTENT_TYPES.TEXT &&
      !info.text.includes("<div") &&
      !info.text.includes("\n");

    const overlay = document.createElement("div");
    Object.assign(overlay.dataset, {
      coords: key,
      pageNum,
      targetHeight: position.height,
      contentType: type,
    });
    overlay.className = [
      "overlay",
      `content-${type}`,
      isSingleLine ? "single-line-layout" : "",
    ]
      .filter(Boolean)
      .join(" ");
    overlay.style.cssText = `left:${toPx(position.left)};top:${toPx(
      position.top
    )};width:${toPx(position.width)};height:${
      type === CONFIG.CONTENT_TYPES.TABLE
        ? toPx(position.height)
        : "fit-content"
    }`;

    const textEl = document.createElement("div");
    textEl.className = "overlay-text";
    textEl.contentEditable = true;
    textEl.innerHTML = formatContent(info);
    textEl.addEventListener(
      "blur",
      debounce((e) => this.#handleTextUpdate(e), CONFIG.UI.DEBOUNCE_TEXT)
    );

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-overlay-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.title = "Delete this overlay";
    deleteBtn.addEventListener("click", (e) => {
      const ol = e.target.closest(".overlay");
      if (ol && confirm(CONFIG.MESSAGES.DELETE_CONFIRM)) {
        this.#state.deleteOverlay(ol.dataset.pageNum, ol.dataset.coords);
        ol.remove();
      }
    });

    overlay.append(textEl, deleteBtn);
    return overlay;
  }

  #handleTextUpdate(event) {
    const overlay = event.target.closest(".overlay");
    if (!overlay) return;
    const type = overlay.dataset.contentType;
    let value;
    if (type === CONFIG.CONTENT_TYPES.TABLE) {
      value = extractTableToJSON(event.target);
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
        CONFIG.CONTENT_TYPES.TABLE,
      ].includes(type)
    ) {
      this.#fontCalc.calculateOptimalSize(overlay);
    }
  }
}

export class OverlayRenderer {
  #state;
  #fontCalc;
  #factory;

  constructor(state, fontCalc) {
    this.#state = state;
    this.#fontCalc = fontCalc;
    this.#factory = new OverlayFactory(state, fontCalc);
  }

  renderPageOverlays(
    wrapper,
    pageNum,
    containerDimensions,
    pdfDimensions,
    mergedPageData
  ) {
    if (!mergedPageData?.blocks) return;

    wrapper.querySelectorAll(".overlay").forEach((el) => el.remove());

    const fragment = document.createDocumentFragment();
    const toOptimize = [];

    mergedPageData.blocks.forEach((info, key) => {
      if (!isRenderableType(info.type)) return;

      const overlay = this.#factory.create({
        key,
        bbox: info.bbox,
        info,
        pageNum,
        containerDimensions,
        pdfDimensions,
      });
      fragment.appendChild(overlay);

      if (
        [
          CONFIG.CONTENT_TYPES.TEXT,
          CONFIG.CONTENT_TYPES.LIST,
          CONFIG.CONTENT_TYPES.TABLE,
        ].includes(info.type)
      ) {
        toOptimize.push(overlay);
      }
    });

    wrapper.appendChild(fragment);
    requestAnimationFrame(() =>
      toOptimize.forEach((o) => this.#fontCalc.calculateOptimalSize(o))
    );
  }
}
