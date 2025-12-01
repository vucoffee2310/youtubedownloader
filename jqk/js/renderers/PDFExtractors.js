import { CONFIG } from "../config.js";

export class TableLayoutExtractor {
  extract(table, wrapper) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return {
      x: tableRect.left - wrapperRect.left,
      y: tableRect.top - wrapperRect.top,
      width: tableRect.width,
      height: tableRect.height,
      rows: Array.from(table.querySelectorAll("tr")).map((row) =>
        this.#extractRow(row, wrapperRect)
      ),
    };
  }

  #extractRow(row, wrapperRect) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const rects = cells.map((c) => c.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      y: top - wrapperRect.top,
      height: bottom - top,
      isHeader: row.querySelector("th") !== null,
      cells: cells.map((cell) => this.#extractCell(cell, wrapperRect)),
    };
  }

  #extractCell(cell, wrapperRect) {
    const rect = cell.getBoundingClientRect();
    const style = getComputedStyle(cell);
    const scaler = cell.querySelector(".cell-scaler");
    let fontSize = parseFloat(style.fontSize);
    if (scaler) fontSize *= parseFloat(scaler.dataset.scale || "1");
    const lineHeight =
      style.lineHeight === "normal"
        ? fontSize * CONFIG.TABLE.LINE_HEIGHT
        : parseFloat(style.lineHeight);

    return {
      x: rect.left - wrapperRect.left,
      y: rect.top - wrapperRect.top,
      width: rect.width,
      height: rect.height,
      paddingTop: parseFloat(style.paddingTop) || 0,
      paddingLeft: parseFloat(style.paddingLeft) || 0,
      paddingRight: parseFloat(style.paddingRight) || 0,
      paddingBottom: parseFloat(style.paddingBottom) || 0,
      text: this.#extractCellText(cell),
      fontSize,
      lineHeight,
      fontWeight: style.fontWeight,
      textAlign: style.textAlign,
      verticalAlign: style.verticalAlign,
      borderWidth: parseFloat(style.borderWidth) || 1,
      isHeader: cell.tagName === "TH",
    };
  }

  #extractCellText(cell) {
    const temp = document.createElement("div");
    temp.innerHTML = cell.innerHTML.trim().replace(CONFIG.REGEX.BR_TAG, "\n");
    return temp.textContent || "";
  }
}

export class OverlayExtractor {
  #tableExtractor = new TableLayoutExtractor();

  extract(overlay, wrapper) {
    const textEl = overlay.querySelector(".overlay-text");
    if (!textEl) return null;

    const oStyle = getComputedStyle(overlay);
    const tStyle = getComputedStyle(textEl);
    const wRect = wrapper.getBoundingClientRect();
    const oRect = overlay.getBoundingClientRect();

    const isList = overlay.classList.contains("content-list");
    const isTable = overlay.classList.contains("content-table");

    const result = {
      x: oRect.left - wRect.left,
      y: oRect.top - wRect.top,
      w: oRect.width,
      h: oRect.height,
      bg: this.#parseRGBA(oStyle.backgroundColor),
      border: this.#parseRGBA(oStyle.borderColor),
      borderW: parseFloat(oStyle.borderWidth) || 0,
      borderR: parseFloat(oStyle.borderRadius) || 0,
      opacity: parseFloat(oStyle.opacity) || 1,
      pad: [
        parseFloat(oStyle.paddingTop) || 0,
        parseFloat(oStyle.paddingLeft) || 0,
        parseFloat(oStyle.paddingRight) || 0,
        parseFloat(oStyle.paddingBottom) || 0,
      ],
      txt: this.#parseRGBA(tStyle.color),
      fontSize: parseFloat(oStyle.fontSize),
      fontStyle: this.#getFontStyle(tStyle),
      fontWeight: parseFloat(tStyle.fontWeight) || 400,
      align: tStyle.textAlign,
      letterSpacing: parseFloat(tStyle.letterSpacing) || 0,
      lineHeight:
        tStyle.lineHeight === "normal"
          ? parseFloat(tStyle.fontSize) * 1.15
          : parseFloat(tStyle.lineHeight),
      textElement: textEl,
      wrapperRect: wRect,
      isList,
      isTable,
      tableLayout: null,
    };

    if (isTable) {
      const table = textEl.querySelector(".data-table");
      if (table)
        result.tableLayout = this.#tableExtractor.extract(table, wrapper);
    }

    return result;
  }

  #parseRGBA(str) {
    const m = str?.match(/(\d+(\.\d+)?)/g) || [];
    const v = m.map(Number);
    while (v.length < 3) v.push(0);
    if (v.length === 3) v.push(1.0);
    return v.slice(0, 4);
  }

  #getFontStyle(style) {
    const bold = style.fontWeight === "bold" || Number(style.fontWeight) >= 700;
    const italic =
      style.fontStyle === "italic" || style.fontStyle === "oblique";
    if (bold && italic) return "bolditalic";
    if (bold) return "bold";
    if (italic) return "italic";
    return "normal";
  }
}
