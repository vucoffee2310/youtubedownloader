import { CONFIG } from "../config.js";

export class TableLayoutExtractor {
  extract(table, wrapper) {
    const wrapperRect = wrapper.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const rows = Array.from(table.querySelectorAll("tr"));
    return {
      x: tableRect.left - wrapperRect.left,
      y: tableRect.top - wrapperRect.top,
      width: tableRect.width,
      height: tableRect.height,
      rows: rows.map((row) => this.#extractRow(row, wrapperRect)),
    };
  }
  #extractRow(row, wrapperRect) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const rowRect = this.#getRowRect(cells);
    return {
      y: rowRect.top - wrapperRect.top,
      height: rowRect.bottom - rowRect.top,
      isHeader: row.querySelector("th") !== null,
      cells: cells.map((cell) => this.#extractCell(cell, wrapperRect)),
    };
  }
  #getRowRect(cells) {
    if (!cells.length) return { top: 0, bottom: 0 };
    const rects = cells.map((c) => c.getBoundingClientRect());
    return {
      top: Math.min(...rects.map((r) => r.top)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  }
  #extractCell(cell, wrapperRect) {
    const cellRect = cell.getBoundingClientRect();
    const cellStyle = getComputedStyle(cell);
    const cellFit = cell.querySelector(".cell-scaler");
    let effectiveFontSize = parseFloat(cellStyle.fontSize);
    if (cellFit) {
      const scale = parseFloat(cellFit.dataset.scale || "1");
      effectiveFontSize *= scale;
    }
    return {
      x: cellRect.left - wrapperRect.left,
      y: cellRect.top - wrapperRect.top,
      width: cellRect.width,
      height: cellRect.height,
      paddingTop: parseFloat(cellStyle.paddingTop) || 0,
      paddingLeft: parseFloat(cellStyle.paddingLeft) || 0,
      paddingRight: parseFloat(cellStyle.paddingRight) || 0,
      paddingBottom: parseFloat(cellStyle.paddingBottom) || 0,
      text: this.#extractCellText(cell),
      fontSize: effectiveFontSize,
      lineHeight: this.#getLineHeight(cellStyle, effectiveFontSize),
      fontWeight: cellStyle.fontWeight,
      textAlign: cellStyle.textAlign,
      verticalAlign: cellStyle.verticalAlign,
      backgroundColor: cellStyle.backgroundColor,
      borderColor: cellStyle.borderColor,
      borderWidth: parseFloat(cellStyle.borderWidth) || 1,
      isHeader: cell.tagName === "TH",
    };
  }
  #extractCellText(cell) {
    const html = cell.innerHTML.trim();
    const withNewlines = html.replace(CONFIG.REGEX.BR_TAG, "\n");
    const temp = document.createElement("div");
    temp.innerHTML = withNewlines;
    return temp.textContent || "";
  }
  #getLineHeight(style, fontSize) {
    if (style.lineHeight === "normal" || !parseFloat(style.lineHeight)) {
      return fontSize * CONFIG.TABLE.LINE_HEIGHT;
    }
    return parseFloat(style.lineHeight);
  }
}

export class OverlayExtractor {
  #tableExtractor;
  constructor() {
    this.#tableExtractor = new TableLayoutExtractor();
  }
  extract(overlay, wrapper) {
    const textEl = overlay.querySelector(".overlay-text");
    if (!textEl) return null;
    const overlayStyle = getComputedStyle(overlay);
    const textStyle = getComputedStyle(textEl);
    const wrapperRect = wrapper.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const isVertical = overlay.classList.contains("vertical-text");
    const isSingleLine = overlay.classList.contains("single-line-layout");
    const isCode = overlay.classList.contains("content-code");
    const isList = overlay.classList.contains("content-list");
    const isTable = overlay.classList.contains("content-table");
    const extracted = {
      x: overlayRect.left - wrapperRect.left,
      y: overlayRect.top - wrapperRect.top,
      w: overlayRect.width,
      h: overlayRect.height,
      bg: this.#parseRGBA(overlayStyle.backgroundColor),
      border: this.#parseRGBA(overlayStyle.borderColor),
      borderW: parseFloat(overlayStyle.borderWidth) || 0,
      borderR: parseFloat(overlayStyle.borderRadius) || 0,
      opacity: parseFloat(overlayStyle.opacity) || 1,
      pad: this.#parsePadding(overlayStyle),
      txt: this.#parseRGBA(textStyle.color),
      fontSize: parseFloat(overlayStyle.fontSize),
      fontStyle: this.#getFontStyle(textStyle),
      fontWeight: parseFloat(textStyle.fontWeight) || 400,
      align: textStyle.textAlign,
      letterSpacing: parseFloat(textStyle.letterSpacing) || 0,
      wordSpacing: parseFloat(textStyle.wordSpacing) || 0,
      lineHeight: this.#getLineHeight(textStyle),
      textElement: textEl,
      wrapperRect,
      isVertical,
      isSingleLine,
      isCode,
      isList,
      isTable,
      tableLayout: null,
    };
    if (isTable) {
      const table = textEl.querySelector(".data-table");
      if (table) {
        extracted.tableLayout = this.#tableExtractor.extract(table, wrapper);
      }
    }
    return extracted;
  }
  #parseRGBA(str) {
    const matches = str?.match(/(\d+(\.\d+)?)/g) || [];
    const values = matches.map(Number);
    while (values.length < 3) values.push(0);
    if (values.length === 3) values.push(1.0);
    return values.slice(0, 4);
  }
  #parsePadding(style) {
    return [
      parseFloat(style.paddingTop) || 0,
      parseFloat(style.paddingLeft) || 0,
      parseFloat(style.paddingRight) || 0,
      parseFloat(style.paddingBottom) || 0,
    ];
  }
  #getFontStyle(style) {
    const weight = style.fontWeight;
    const fontStyle = style.fontStyle;
    const bold = weight === "bold" || Number(weight) >= 700;
    const italic = fontStyle === "italic" || fontStyle === "oblique";
    if (bold && italic) return "bolditalic";
    if (bold) return "bold";
    if (italic) return "italic";
    return "normal";
  }
  #getLineHeight(style) {
    if (style.lineHeight === "normal") {
      return parseFloat(style.fontSize) * 1.15;
    }
    return parseFloat(style.lineHeight);
  }
}
