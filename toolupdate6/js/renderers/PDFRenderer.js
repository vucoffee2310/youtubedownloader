import { CONFIG } from "../config.js";
import { OverlayExtractor } from "./PDFExtractors.js";

class TextMeasurement {
  #baselineCache;
  constructor() {
    this.#baselineCache = new Map();
  }
  measureBaselineRatio(fontFamily, fontSize) {
    const key = `${fontFamily}-${fontSize}`;
    if (this.#baselineCache.has(key)) {
      return this.#baselineCache.get(key);
    }
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(
        "áàảãạĂăắằẳẵặÂâấầẩẫậéèẻẽẹÊêếềểễệíìỉĩịóòỏõọÔôốồổỗộƠơớờởỡợúùủũụƯưứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ"
      );
      if (
        metrics.actualBoundingBoxAscent !== undefined &&
        metrics.actualBoundingBoxDescent !== undefined
      ) {
        const ratio =
          metrics.actualBoundingBoxAscent /
          (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
        this.#baselineCache.set(key, ratio);
        return ratio;
      }
    } catch (error) {
      console.warn("Canvas metrics unavailable:", error);
    }
    this.#baselineCache.set(key, CONFIG.PDF_RENDERER.BASELINE_RATIO_DEFAULT);
    return CONFIG.PDF_RENDERER.BASELINE_RATIO_DEFAULT;
  }
  clearCache() {
    this.#baselineCache.clear();
  }
}

class ShapeRenderer {
  render(pdf, overlays) {
    const opaque = new jspdf.GState({ opacity: 1 });
    this.#renderBackgrounds(pdf, overlays);
    this.#renderBorders(pdf, overlays);
    pdf.setGState(opaque);
  }
  #renderBackgrounds(pdf, overlays) {
    overlays.forEach((overlay) => {
      if (overlay.bg[3] <= 0) return;
      pdf.setGState(
        new jspdf.GState({ opacity: overlay.opacity * overlay.bg[3] })
      );
      pdf.setFillColor(...overlay.bg.slice(0, 3));
      if (overlay.borderR > 1) {
        pdf.roundedRect(
          overlay.x,
          overlay.y,
          overlay.w,
          overlay.h,
          overlay.borderR,
          overlay.borderR,
          "F"
        );
      } else {
        pdf.rect(overlay.x, overlay.y, overlay.w, overlay.h, "F");
      }
    });
  }
  #renderBorders(pdf, overlays) {
    overlays.forEach((overlay) => {
      if (overlay.borderW <= 0 || overlay.border[3] <= 0) return;
      pdf.setGState(new jspdf.GState({ opacity: overlay.opacity }));
      pdf.setLineWidth(overlay.borderW);
      pdf.setDrawColor(...overlay.border.slice(0, 3));
      if (overlay.borderR > 1) {
        pdf.roundedRect(
          overlay.x,
          overlay.y,
          overlay.w,
          overlay.h,
          overlay.borderR,
          overlay.borderR,
          "S"
        );
      } else {
        pdf.rect(overlay.x, overlay.y, overlay.w, overlay.h, "S");
      }
    });
  }
}

class CodeRenderer {
  render(pdf, overlay) {
    const codeText = overlay.textElement.textContent || "";
    const lines = codeText.split(CONFIG.REGEX.NEWLINE);
    const lineHeight = overlay.fontSize * CONFIG.PDF_RENDERER.CODE_LINE_HEIGHT;
    const padding = CONFIG.PDF_RENDERER.CODE_PADDING;
    const maxWidth = overlay.w - padding * 2;
    let currentY = overlay.y + padding + overlay.fontSize;
    lines.forEach((line) => {
      if (line.length === 0) {
        currentY += lineHeight;
        return;
      }
      const lineWidth = pdf.getTextWidth(line);
      if (lineWidth <= maxWidth) {
        pdf.text(line, overlay.x + padding, currentY, {
          baseline: "alphabetic",
        });
        currentY += lineHeight;
      } else {
        const wrapped = pdf.splitTextToSize(line, maxWidth);
        wrapped.forEach((wrappedLine, idx) => {
          const finalLine =
            idx > 0
              ? CONFIG.PDF_RENDERER.CODE_CONTINUATION_INDENT +
                wrappedLine.trim()
              : wrappedLine;
          pdf.text(finalLine, overlay.x + padding, currentY, {
            baseline: "alphabetic",
          });
          currentY += lineHeight;
        });
      }
    });
  }
}

class ListRenderer {
  render(pdf, overlay) {
    const items = this.#extractListItems(overlay.textElement);
    const bulletChar = "•";
    const bulletIndent =
      overlay.fontSize * CONFIG.PDF_RENDERER.LIST_BULLET_INDENT;
    const continuationIndent =
      overlay.fontSize * CONFIG.PDF_RENDERER.LIST_CONTINUATION_INDENT;
    const baseLineHeight =
      overlay.fontSize * CONFIG.PDF_RENDERER.LIST_LINE_HEIGHT;
    const itemSpacing =
      overlay.fontSize * CONFIG.PDF_RENDERER.LIST_ITEM_SPACING;
    let currentY = overlay.y + overlay.pad[0] + overlay.fontSize;
    items.forEach((item, index) => {
      const maxWidth =
        overlay.w -
        overlay.pad[1] -
        overlay.pad[2] -
        (item.hasBullet
          ? bulletIndent + overlay.fontSize * 0.5
          : continuationIndent);
      const lines = pdf.splitTextToSize(item.text, maxWidth);
      if (item.hasBullet) {
        pdf.text(bulletChar, overlay.x + overlay.pad[1], currentY, {
          baseline: "alphabetic",
        });
        lines.forEach((line, lineIdx) => {
          const xPos =
            overlay.x + overlay.pad[1] + bulletIndent + overlay.fontSize * 0.5;
          pdf.text(line, xPos, currentY + lineIdx * baseLineHeight, {
            baseline: "alphabetic",
          });
        });
      } else {
        lines.forEach((line, lineIdx) => {
          const xPos = overlay.x + overlay.pad[1] + continuationIndent;
          pdf.text(line, xPos, currentY + lineIdx * baseLineHeight, {
            baseline: "alphabetic",
          });
        });
      }
      currentY += lines.length * baseLineHeight;
      if (index < items.length - 1) {
        currentY += itemSpacing;
      }
    });
  }
  #extractListItems(textElement) {
    const listItems = textElement.querySelectorAll(".list-item");
    if (listItems.length > 0) {
      return Array.from(listItems).map((item) =>
        this.#parseListItem(item.textContent.trim())
      );
    }
    return textElement.textContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line)
      .map((line) => this.#parseListItem(line));
  }
  #parseListItem(text) {
    const hasBullet = CONFIG.REGEX.LIST_BULLET.test(text);
    return {
      text: hasBullet ? text.substring(2).trim() : text,
      hasBullet,
    };
  }
}

class VerticalTextRenderer {
  render(pdf, overlay) {
    const text = overlay.textElement.textContent || "";
    const centerX = overlay.x + overlay.w / 2;
    const centerY = overlay.y + overlay.h / 2;
    pdf.saveGraphicsState();
    if (Math.abs(overlay.letterSpacing) > 0.1) {
      this.#renderWithSpacing(pdf, text, centerX, centerY, overlay);
    } else {
      pdf.text(text, centerX, centerY, {
        angle: 90,
        baseline: "middle",
        align: "center",
      });
    }
    pdf.restoreGraphicsState();
  }
  #renderWithSpacing(pdf, text, centerX, centerY, overlay) {
    let currentY =
      centerY - (text.length * (overlay.fontSize + overlay.letterSpacing)) / 2;
    text.split("").forEach((char) => {
      pdf.text(char, centerX, currentY, {
        angle: 90,
        baseline: "middle",
        align: "center",
      });
      currentY += overlay.fontSize + overlay.letterSpacing;
    });
  }
}

class StandardTextRenderer {
  #textMeasurement;
  constructor(textMeasurement) {
    this.#textMeasurement = textMeasurement;
  }
  render(pdf, overlay) {
    const lines = this.#extractLines(overlay.textElement, overlay.wrapperRect);
    lines.forEach((block) => {
      block.lines.forEach((line) => {
        if (line.charPositions && line.charPositions.length > 0) {
          this.#renderWithCharPositions(pdf, line);
        } else {
          pdf.text(line.text, line.x, line.baseline, {
            baseline: "alphabetic",
          });
        }
      });
    });
  }
  #extractLines(textElement, wrapperRect) {
    const blocks = textElement.querySelectorAll(".merged-text-block");
    const result = [];
    if (blocks.length > 0) {
      blocks.forEach((block) => {
        const lines = this.#getLinePositions(block, wrapperRect);
        if (lines.length) result.push({ lines });
      });
    } else {
      const lines = this.#getLinePositions(textElement, wrapperRect);
      if (lines.length) result.push({ lines });
    }
    return result;
  }
  #getLinePositions(element, wrapperRect) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const range = document.createRange();
    const lines = [];
    const style = getComputedStyle(element);
    const baselineRatio = this.#textMeasurement.measureBaselineRatio(
      style.fontFamily,
      parseFloat(style.fontSize)
    );
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    const hasCustomSpacing = Math.abs(letterSpacing) > 0.1;
    let currentLine = null;
    let textNode;
    const finishLine = () => {
      if (currentLine?.text.trim()) {
        const height = currentLine.maxY - currentLine.minY;
        const lineData = {
          text: currentLine.text.trim(),
          x: Math.round((currentLine.minX - wrapperRect.left) * 100) / 100,
          baseline:
            Math.round(
              (currentLine.minY - wrapperRect.top + height * baselineRatio) *
                100
            ) / 100,
        };
        if (hasCustomSpacing && currentLine.charPositions) {
          lineData.charPositions = currentLine.charPositions.map(
            (pos) => Math.round((pos - wrapperRect.left) * 100) / 100
          );
        }
        lines.push(lineData);
      }
    };
    while ((textNode = walker.nextNode())) {
      const nodeText = textNode.textContent;
      for (let i = 0; i < nodeText.length; i++) {
        try {
          range.setStart(textNode, i);
          range.setEnd(textNode, i + 1);
          const rect = range.getBoundingClientRect();
          if (currentLine && Math.abs(rect.top - currentLine.lastY) > 3) {
            finishLine();
            currentLine = null;
          }
          if (!currentLine) {
            currentLine = {
              text: nodeText[i],
              minX: rect.left,
              minY: rect.top,
              maxY: rect.bottom,
              lastY: rect.top,
              charPositions: hasCustomSpacing ? [rect.left] : null,
            };
          } else {
            currentLine.text += nodeText[i];
            currentLine.minX = Math.min(currentLine.minX, rect.left);
            currentLine.minY = Math.min(currentLine.minY, rect.top);
            currentLine.maxY = Math.max(currentLine.maxY, rect.bottom);
            currentLine.lastY = rect.top;
            if (hasCustomSpacing) {
              currentLine.charPositions.push(rect.left);
            }
          }
        } catch (error) {
          if (currentLine) currentLine.text += nodeText[i];
        }
      }
    }
    finishLine();
    return lines;
  }
  #renderWithCharPositions(pdf, line) {
    const chars = line.text.split("");
    chars.forEach((char, index) => {
      const x = line.charPositions[index] || line.x;
      pdf.text(char, x, line.baseline, { baseline: "alphabetic" });
    });
  }
}

class TablePDFRenderer {
  render(pdf, overlays) {
    overlays.forEach((overlay) => {
      if (!overlay.tableLayout) return;
      this.#renderTable(pdf, overlay);
    });
  }
  #renderTable(pdf, overlay) {
    const layout = overlay.tableLayout;
    const tableBorderColor = overlay.border;
    const textColor = overlay.txt;
    layout.rows.forEach((row, rowIdx) => {
      this.#renderRowBackground(pdf, row, rowIdx, layout, overlay.opacity);
      this.#renderRowCells(
        pdf,
        row,
        tableBorderColor,
        textColor,
        overlay.opacity
      );
    });
    this.#renderTableBorder(pdf, layout, tableBorderColor);
  }
  #renderRowBackground(pdf, row, rowIdx, layout, opacity) {
    const isHeader = row.isHeader;
    let bgOpacity;
    if (isHeader) {
      bgOpacity = CONFIG.PDF_RENDERER.TABLE_HEADER_OPACITY;
    } else if (rowIdx % 2 === 1) {
      bgOpacity = CONFIG.PDF_RENDERER.TABLE_ROW_EVEN_OPACITY;
    } else {
      bgOpacity = CONFIG.PDF_RENDERER.TABLE_ROW_ODD_OPACITY;
    }
    pdf.setFillColor(0, 0, 0);
    pdf.setGState(new jspdf.GState({ opacity: bgOpacity * opacity }));
    pdf.rect(layout.x, row.y, layout.width, row.height, "F");
    pdf.setGState(new jspdf.GState({ opacity }));
  }
  #renderRowCells(pdf, row, tableBorderColor, textColor, opacity) {
    row.cells.forEach((cell) => {
      const isHeader = cell.isHeader;
      pdf.setFont(CONFIG.FONT.NAME, isHeader ? "bold" : "normal");
      pdf.setFontSize(cell.fontSize);
      pdf.setTextColor(...textColor.slice(0, 3));
      const textX = cell.x + cell.paddingLeft;
      const textWidth = cell.width - cell.paddingLeft - cell.paddingRight;
      const lines = this.#wrapCellText(pdf, cell.text, textWidth);
      const lineHeight =
        cell.lineHeight || cell.fontSize * CONFIG.TABLE.LINE_HEIGHT;
      const totalTextHeight = lines.length * lineHeight;
      const textY = this.#calculateTextY(cell, totalTextHeight, lineHeight);
      this.#renderCellText(pdf, lines, textX, textY, lineHeight, cell);
      this.#renderCellBorder(pdf, cell, tableBorderColor);
    });
  }
  #wrapCellText(pdf, text, maxWidth) {
    const lines = text.split("\n");
    const wrappedLines = [];
    lines.forEach((line) => {
      if (!line.trim()) {
        wrappedLines.push("");
      } else {
        const wrapped = pdf.splitTextToSize(line, maxWidth);
        wrappedLines.push(...wrapped);
      }
    });
    return wrappedLines;
  }
  #calculateTextY(cell, totalTextHeight, lineHeight) {
    if (cell.verticalAlign === "middle") {
      return cell.y + (cell.height - totalTextHeight) / 2;
    } else if (cell.verticalAlign === "bottom") {
      return cell.y + cell.height - totalTextHeight - cell.paddingBottom;
    }
    return cell.y + cell.paddingTop;
  }
  #renderCellText(pdf, lines, textX, textY, lineHeight, cell) {
    lines.forEach((line, lineIdx) => {
      const y = textY + lineIdx * lineHeight;
      let x = textX;
      if (cell.textAlign === "center") {
        const w = pdf.getTextWidth(line);
        x = cell.x + (cell.width - w) / 2;
      } else if (cell.textAlign === "right") {
        const w = pdf.getTextWidth(line);
        x = cell.x + cell.width - w - cell.paddingRight;
      }
      pdf.text(line, x, y, { baseline: "top" });
    });
  }
  #renderCellBorder(pdf, cell, borderColor) {
    pdf.setDrawColor(...borderColor.slice(0, 3));
    pdf.setLineWidth(cell.borderWidth);
    pdf.line(
      cell.x + cell.width,
      cell.y,
      cell.x + cell.width,
      cell.y + cell.height
    );
    pdf.line(
      cell.x,
      cell.y + cell.height,
      cell.x + cell.width,
      cell.y + cell.height
    );
  }
  #renderTableBorder(pdf, layout, borderColor) {
    pdf.setDrawColor(...borderColor.slice(0, 3));
    pdf.setLineWidth(1);
    pdf.rect(layout.x, layout.y, layout.width, layout.height);
  }
}

class TextRenderer {
  #textMeasurement;
  #listRenderer;
  #codeRenderer;
  #verticalRenderer;
  #standardRenderer;
  constructor(textMeasurement) {
    this.#textMeasurement = textMeasurement;
    this.#listRenderer = new ListRenderer();
    this.#codeRenderer = new CodeRenderer();
    this.#verticalRenderer = new VerticalTextRenderer();
    this.#standardRenderer = new StandardTextRenderer(textMeasurement);
  }
  render(pdf, overlays) {
    const opaque = new jspdf.GState({ opacity: 1 });
    overlays.forEach((overlay) => {
      if (!overlay.textElement) return;
      this.#setupFont(pdf, overlay);
      pdf.setGState(new jspdf.GState({ opacity: overlay.opacity }));
      if (overlay.isCode) {
        this.#codeRenderer.render(pdf, overlay);
      } else if (overlay.isList) {
        this.#listRenderer.render(pdf, overlay);
      } else if (overlay.isVertical) {
        this.#verticalRenderer.render(pdf, overlay);
      } else {
        this.#standardRenderer.render(pdf, overlay);
      }
    });
    pdf.setGState(opaque);
  }
  #setupFont(pdf, overlay) {
    let fontName, fontStyle;
    if (overlay.isCode) {
      fontName = CONFIG.CODE_FONT?.NAME || "courier";
      fontStyle = "bold";
    } else {
      fontName = CONFIG.FONT.NAME;
      fontStyle = overlay.fontStyle;
    }
    pdf.setFont(fontName, fontStyle);
    pdf.setFontSize(overlay.fontSize);
    pdf.setTextColor(...overlay.txt.slice(0, 3));
  }
}

export class PDFRenderer {
  #textMeasurement;
  #shapeRenderer;
  #textRenderer;
  #tableRenderer;
  #extractor;
  constructor() {
    this.#textMeasurement = new TextMeasurement();
    this.#shapeRenderer = new ShapeRenderer();
    this.#textRenderer = new TextRenderer(this.#textMeasurement);
    this.#tableRenderer = new TablePDFRenderer();
    this.#extractor = new OverlayExtractor();
  }
  extractOverlay(overlay, wrapper) {
    return this.#extractor.extract(overlay, wrapper);
  }
  drawShapes(pdf, overlays) {
    this.#shapeRenderer.render(pdf, overlays);
  }
  drawText(pdf, overlays) {
    const textOverlays = overlays.filter((o) => !o.isTable);
    const tableOverlays = overlays.filter((o) => o.isTable);
    this.#textRenderer.render(pdf, textOverlays);
    this.#tableRenderer.render(pdf, tableOverlays);
  }
}
