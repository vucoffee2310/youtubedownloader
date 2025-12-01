import { CONFIG } from "../config.js";
import { OverlayExtractor } from "./PDFExtractors.js";

export class PDFRenderer {
  #baselineCache = new Map();
  #extractor = new OverlayExtractor();

  extractOverlay(overlay, wrapper) {
    return this.#extractor.extract(overlay, wrapper);
  }

  drawShapes(pdf, overlays) {
    const opaque = new jspdf.GState({ opacity: 1 });
    overlays.forEach((o) => {
      if (o.bg[3] > 0) {
        pdf.setGState(new jspdf.GState({ opacity: o.opacity * o.bg[3] }));
        pdf.setFillColor(...o.bg.slice(0, 3));
        o.borderR > 1
          ? pdf.roundedRect(o.x, o.y, o.w, o.h, o.borderR, o.borderR, "F")
          : pdf.rect(o.x, o.y, o.w, o.h, "F");
      }
      if (o.borderW > 0 && o.border[3] > 0) {
        pdf.setGState(new jspdf.GState({ opacity: o.opacity }));
        pdf.setLineWidth(o.borderW);
        pdf.setDrawColor(...o.border.slice(0, 3));
        o.borderR > 1
          ? pdf.roundedRect(o.x, o.y, o.w, o.h, o.borderR, o.borderR, "S")
          : pdf.rect(o.x, o.y, o.w, o.h, "S");
      }
    });
    pdf.setGState(opaque);
  }

  drawText(pdf, overlays) {
    const opaque = new jspdf.GState({ opacity: 1 });
    overlays.forEach((o) => {
      if (!o.textElement) return;
      pdf.setFont(CONFIG.FONT.NAME, o.fontStyle);
      pdf.setFontSize(o.fontSize);
      pdf.setTextColor(...o.txt.slice(0, 3));
      pdf.setGState(new jspdf.GState({ opacity: o.opacity }));

      if (o.isTable) this.#renderTable(pdf, o);
      else if (o.isList) this.#renderList(pdf, o);
      else this.#renderStandardText(pdf, o);
    });
    pdf.setGState(opaque);
  }

  #renderList(pdf, o) {
    const items = this.#extractListItems(o.textElement);
    const bulletIndent = o.fontSize * CONFIG.PDF_RENDERER.LIST_BULLET_INDENT;
    const lineHeight = o.fontSize * CONFIG.PDF_RENDERER.LIST_LINE_HEIGHT;
    const itemSpacing = o.fontSize * CONFIG.PDF_RENDERER.LIST_ITEM_SPACING;
    let y = o.y + o.pad[0] + o.fontSize;

    items.forEach((item, idx) => {
      const maxW =
        o.w -
        o.pad[1] -
        o.pad[2] -
        (item.hasBullet ? bulletIndent + o.fontSize * 0.5 : o.fontSize * 0.3);
      const lines = pdf.splitTextToSize(item.text, maxW);
      const xPos =
        o.x +
        o.pad[1] +
        (item.hasBullet ? bulletIndent + o.fontSize * 0.5 : o.fontSize * 0.3);
      if (item.hasBullet)
        pdf.text("•", o.x + o.pad[1], y, { baseline: "alphabetic" });
      lines.forEach((line, i) =>
        pdf.text(line, xPos, y + i * lineHeight, { baseline: "alphabetic" })
      );
      y +=
        lines.length * lineHeight + (idx < items.length - 1 ? itemSpacing : 0);
    });
  }

  #extractListItems(el) {
    const items = el.querySelectorAll(".list-item");
    if (items.length)
      return Array.from(items).map((i) =>
        this.#parseListItem(i.textContent.trim())
      );
    return el.textContent
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => this.#parseListItem(l));
  }

  #parseListItem(text) {
    const hasBullet = CONFIG.REGEX.LIST_BULLET.test(text);
    return { text: hasBullet ? text.substring(2).trim() : text, hasBullet };
  }

  #renderStandardText(pdf, o) {
    const lines = this.#extractTextLines(o.textElement, o.wrapperRect);
    lines.forEach((block) => {
      block.lines.forEach((line) => {
        if (line.charPositions?.length) {
          line.text
            .split("")
            .forEach((char, i) =>
              pdf.text(char, line.charPositions[i] || line.x, line.baseline, {
                baseline: "alphabetic",
              })
            );
        } else {
          pdf.text(line.text, line.x, line.baseline, {
            baseline: "alphabetic",
          });
        }
      });
    });
  }

  #extractTextLines(el, wrapperRect) {
    const blocks = el.querySelectorAll(".merged-text-block");
    const result = [];
    const process = (node) => {
      const lines = this.#getLinePositions(node, wrapperRect);
      if (lines.length) result.push({ lines });
    };
    if (blocks.length) blocks.forEach(process);
    else process(el);
    return result;
  }

  #getLinePositions(el, wrapperRect) {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const range = document.createRange();
    const lines = [];
    const style = getComputedStyle(el);
    const baselineRatio = this.#measureBaselineRatio(
      style.fontFamily,
      parseFloat(style.fontSize)
    );
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    const hasSpacing = Math.abs(letterSpacing) > 0.1;
    let current = null,
      node;

    const finish = () => {
      if (current?.text.trim()) {
        const h = current.maxY - current.minY;
        const lineData = {
          text: current.text.trim(),
          x: Math.round((current.minX - wrapperRect.left) * 100) / 100,
          baseline:
            Math.round(
              (current.minY - wrapperRect.top + h * baselineRatio) * 100
            ) / 100,
        };
        if (hasSpacing && current.charPositions) {
          lineData.charPositions = current.charPositions.map(
            (p) => Math.round((p - wrapperRect.left) * 100) / 100
          );
        }
        lines.push(lineData);
      }
    };

    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.textContent.length; i++) {
        try {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getBoundingClientRect();
          if (current && Math.abs(rect.top - current.lastY) > 3) {
            finish();
            current = null;
          }
          if (!current) {
            current = {
              text: node.textContent[i],
              minX: rect.left,
              minY: rect.top,
              maxY: rect.bottom,
              lastY: rect.top,
              charPositions: hasSpacing ? [rect.left] : null,
            };
          } else {
            current.text += node.textContent[i];
            current.minX = Math.min(current.minX, rect.left);
            current.minY = Math.min(current.minY, rect.top);
            current.maxY = Math.max(current.maxY, rect.bottom);
            current.lastY = rect.top;
            if (hasSpacing) current.charPositions.push(rect.left);
          }
        } catch {
          if (current) current.text += node.textContent[i];
        }
      }
    }
    finish();
    return lines;
  }

  #measureBaselineRatio(fontFamily, fontSize) {
    const key = `${fontFamily}-${fontSize}`;
    if (this.#baselineCache.has(key)) return this.#baselineCache.get(key);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      ctx.font = `${fontSize}px ${fontFamily}`;
      const m = ctx.measureText(
        "áàảãạĂăắằẳẵặÂâấầẩẫậéèẻẽẹÊêếềểễệíìỉĩịóòỏõọÔôốồổỗộƠơớờởỡợúùủũụƯưứừửữựýỳỷỹỵ"
      );
      if (
        m.actualBoundingBoxAscent !== undefined &&
        m.actualBoundingBoxDescent !== undefined
      ) {
        const ratio =
          m.actualBoundingBoxAscent /
          (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
        this.#baselineCache.set(key, ratio);
        return ratio;
      }
    } catch {}
    this.#baselineCache.set(key, CONFIG.PDF_RENDERER.BASELINE_RATIO_DEFAULT);
    return CONFIG.PDF_RENDERER.BASELINE_RATIO_DEFAULT;
  }

  #renderTable(pdf, o) {
    if (!o.tableLayout) return;
    const { rows } = o.tableLayout;
    rows.forEach((row, rowIdx) => {
      const bgOpacity = row.isHeader
        ? CONFIG.PDF_RENDERER.TABLE_HEADER_OPACITY
        : rowIdx % 2 === 1
        ? CONFIG.PDF_RENDERER.TABLE_ROW_EVEN_OPACITY
        : CONFIG.PDF_RENDERER.TABLE_ROW_ODD_OPACITY;
      pdf.setFillColor(0, 0, 0);
      pdf.setGState(new jspdf.GState({ opacity: bgOpacity * o.opacity }));
      pdf.rect(o.tableLayout.x, row.y, o.tableLayout.width, row.height, "F");
      pdf.setGState(new jspdf.GState({ opacity: o.opacity }));

      row.cells.forEach((cell) => {
        pdf.setFont(CONFIG.FONT.NAME, cell.isHeader ? "bold" : "normal");
        pdf.setFontSize(cell.fontSize);
        pdf.setTextColor(...o.txt.slice(0, 3));
        const textWidth = cell.width - cell.paddingLeft - cell.paddingRight;
        const lines = this.#wrapCellText(pdf, cell.text, textWidth);
        const lineH =
          cell.lineHeight || cell.fontSize * CONFIG.TABLE.LINE_HEIGHT;
        const totalH = lines.length * lineH;
        let textY =
          cell.verticalAlign === "middle"
            ? cell.y + (cell.height - totalH) / 2
            : cell.verticalAlign === "bottom"
            ? cell.y + cell.height - totalH - cell.paddingBottom
            : cell.y + cell.paddingTop;

        lines.forEach((line, i) => {
          let x = cell.x + cell.paddingLeft;
          if (cell.textAlign === "center")
            x = cell.x + (cell.width - pdf.getTextWidth(line)) / 2;
          else if (cell.textAlign === "right")
            x =
              cell.x + cell.width - pdf.getTextWidth(line) - cell.paddingRight;
          pdf.text(line, x, textY + i * lineH, { baseline: "top" });
        });

        pdf.setDrawColor(...o.border.slice(0, 3));
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
      });
    });
    pdf.setDrawColor(...o.border.slice(0, 3));
    pdf.setLineWidth(1);
    pdf.rect(
      o.tableLayout.x,
      o.tableLayout.y,
      o.tableLayout.width,
      o.tableLayout.height
    );
  }

  #wrapCellText(pdf, text, maxWidth) {
    const result = [];
    text.split("\n").forEach((line) => {
      if (!line.trim()) result.push("");
      else result.push(...pdf.splitTextToSize(line, maxWidth));
    });
    return result;
  }
}
