import { CONFIG } from "../config.js";
import { toPx, clamp, LRUCache } from "../utils.js";

class TableMeasurement {
  #canvas;
  #ctx;

  constructor() {
    this.#canvas = document.createElement("canvas");
    this.#ctx = this.#canvas.getContext("2d");
  }

  measureAll(cells, fontSize, colWidths, rowHeight) {
    return cells.map((row) =>
      row.map((cell, colIdx) =>
        this.#measureCell(cell, fontSize, colWidths[colIdx], rowHeight)
      )
    );
  }

  #measureCell(cell, fontSize, colWidth, rowHeight) {
    const availWidth = colWidth - 2 * CONFIG.TABLE.CELL_PADDING;
    const availHeight = rowHeight - 2 * CONFIG.TABLE.CELL_PADDING;
    const fontWeight = cell.isHeader ? "bold" : "normal";

    this.#ctx.font = `${fontWeight} ${fontSize}px "${CONFIG.FONT.NAME}", sans-serif`;

    const wrappedLines = this.#wrapText(cell.text, availWidth, cell.isHeader);
    const lineHeight = fontSize * CONFIG.TABLE.LINE_HEIGHT;
    const totalHeight = wrappedLines.length * lineHeight;
    const maxWidth = Math.max(
      ...wrappedLines.map((line) => this.#ctx.measureText(line).width),
      0
    );

    const heightTolerance = cell.isHeader ? 1.5 : 1.0;

    return {
      wrappedLines,
      actualWidth: maxWidth,
      actualHeight: totalHeight,
      fitsWidth: maxWidth <= availWidth,
      fitsHeight: totalHeight <= availHeight * heightTolerance,
      utilization:
        (maxWidth / availWidth) *
        (totalHeight / (availHeight * heightTolerance)),
      isHeader: cell.isHeader,
      lineCount: wrappedLines.length,
    };
  }

  #wrapText(text, availWidth, isHeader) {
    const lines = text.split(CONFIG.REGEX.NEWLINE);
    const wrappedLines = [];
    const wrapFactor = isHeader ? CONFIG.TABLE.WRAP_WIDTH_FACTOR : 1.0;

    lines.forEach((line) => {
      if (!line.trim()) {
        wrappedLines.push("");
        return;
      }

      const words = line.split(" ");
      let currentLine = "";

      words.forEach((word) => {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = this.#ctx.measureText(testLine);

        if (metrics.width <= availWidth * wrapFactor) {
          currentLine = testLine;
        } else {
          if (currentLine) wrappedLines.push(currentLine);
          currentLine = word;
        }
      });

      if (currentLine) wrappedLines.push(currentLine);
    });

    return wrappedLines;
  }
}

class ColumnOptimizer {
  calculateInitialWidths(cells, cols, availWidth) {
    const scores = this.#calculateColumnScores(cells, cols);
    const percentages = this.#scoresToPercentages(scores, cols);
    return percentages.map((pct) => (availWidth * pct) / 100);
  }

  redistribute(colWidths, measurements) {
    const usage = colWidths.map((width, i) => {
      const cells = measurements.map((row) => row[i]);
      return {
        index: i,
        width,
        avgUtil: cells.reduce((s, c) => s + c.utilization, 0) / cells.length,
        maxWidth: Math.max(...cells.map((c) => c.actualWidth)),
        needsMore: cells.some((c) => !c.fitsWidth),
      };
    });

    const donors = usage.filter(
      (c) => c.avgUtil < CONFIG.TABLE.HEADROOM_THRESHOLD && !c.needsMore
    );
    const receivers = usage.filter((c) => c.needsMore);

    if (!donors.length || !receivers.length) return false;

    const available = donors.reduce(
      (sum, c) =>
        sum + c.width * (1 - c.avgUtil) * CONFIG.TABLE.REDISTRIBUTION_FACTOR,
      0
    );
    const needed = receivers.reduce(
      (sum, c) => sum + (c.maxWidth - c.width),
      0
    );
    const transfer = Math.min(available, needed);

    donors.forEach((c) => {
      colWidths[c.index] -=
        (c.width *
          (1 - c.avgUtil) *
          CONFIG.TABLE.REDISTRIBUTION_FACTOR *
          transfer) /
        available;
    });

    receivers.forEach((c) => {
      colWidths[c.index] += ((c.maxWidth - c.width) * transfer) / needed;
    });

    return true;
  }

  #calculateColumnScores(cells, cols) {
    const scores = new Array(cols).fill(0);

    cells.forEach((row) => {
      row.forEach((cell, colIdx) => {
        const maxLen = Math.max(
          ...cell.text.split(CONFIG.REGEX.NEWLINE).map((l) => l.trim().length),
          1
        );
        const boost = cell.isHeader ? CONFIG.TABLE.HEADER_BOOST : 1.0;
        scores[colIdx] = Math.max(scores[colIdx], maxLen * boost);
      });
    });

    return scores;
  }

  #scoresToPercentages(scores, cols) {
    const minPct = Math.max(
      100 / (cols * CONFIG.TABLE.COL_DIVISOR),
      CONFIG.TABLE.MIN_COL_PERCENT
    );
    const maxPct = CONFIG.TABLE.MAX_COL_PERCENT;

    // Convert scores to weights and then to percentages
    const weights = scores.map((s) => Math.sqrt(s) + 0.1);
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Single pass: convert to percentage and clamp
    let percentages = weights.map((w) => {
      const pct = (w / totalWeight) * 100;
      return Math.max(minPct, Math.min(maxPct, pct));
    });

    // Normalize to 100%
    const total = percentages.reduce((a, b) => a + b, 0);
    return percentages.map((p) => (p / total) * 100);
  }
}

class CellScaler {
  scaleCells(table, cellsData, baseFontSize, colWidths, rowHeight) {
    const rows = table.querySelectorAll("tr");

    rows.forEach((row, rowIdx) => {
      const cellElements = Array.from(row.querySelectorAll("th, td"));
      cellElements.forEach((cellEl, colIdx) => {
        const cellData = cellsData[rowIdx]?.[colIdx];
        if (!cellData) return;
        this.#scaleCell(
          cellEl,
          cellData,
          baseFontSize,
          colWidths[colIdx],
          rowHeight
        );
      });
    });
  }

  #scaleCell(cellEl, cellData, baseFontSize, colWidth, rowHeight) {
    const isHeader = cellEl.tagName === "TH";
    const availWidth = colWidth - 2 * CONFIG.TABLE.CELL_PADDING;
    const availHeight = rowHeight - 2 * CONFIG.TABLE.CELL_PADDING;

    if (availWidth <= 0 || availHeight <= 0) return;

    const wrapper = this.#getOrCreateWrapper(cellEl);
    this.#setupWrapper(wrapper, baseFontSize, availWidth);

    const textContent = wrapper.textContent?.trim() || "";
    if (!textContent || textContent === "&nbsp;") {
      wrapper.dataset.scale = "1.000";
      return;
    }

    wrapper.offsetHeight;

    const scale = this.#calculateScale(
      wrapper,
      availWidth,
      availHeight,
      isHeader
    );
    wrapper.style.transform = `scale(${scale})`;
    wrapper.dataset.scale = scale.toFixed(3);
  }

  #getOrCreateWrapper(cellEl) {
    let wrapper = cellEl.querySelector(".cell-scaler");
    if (!wrapper) {
      wrapper = document.createElement("span");
      wrapper.className = "cell-scaler";
      while (cellEl.firstChild) {
        wrapper.appendChild(cellEl.firstChild);
      }
      cellEl.appendChild(wrapper);
    }
    return wrapper;
  }

  #setupWrapper(wrapper, baseFontSize, availWidth) {
    wrapper.style.display = "inline-block";
    wrapper.style.transformOrigin = "top left";
    wrapper.style.lineHeight = String(CONFIG.TABLE.LINE_HEIGHT);
    wrapper.style.transform = "scale(1)";
    wrapper.style.fontSize = `${baseFontSize}px`;
    wrapper.style.whiteSpace = "normal";
    wrapper.style.wordBreak = "break-word";
    wrapper.style.overflowWrap = "break-word";
    wrapper.style.maxWidth = `${availWidth}px`;
    wrapper.style.verticalAlign = "middle";
  }

  #calculateScale(wrapper, availWidth, availHeight, isHeader) {
    const wrappedWidth = wrapper.offsetWidth;
    const wrappedHeight = wrapper.offsetHeight;

    if (wrappedWidth === 0 || wrappedHeight === 0) {
      return CONFIG.TABLE.MIN_SCALE;
    }

    const scaleX = availWidth / wrappedWidth;
    const scaleY = availHeight / wrappedHeight;
    const maxScale = isHeader
      ? CONFIG.TABLE.MAX_SCALE_HEADER
      : CONFIG.TABLE.MAX_SCALE_DATA;

    let scale = Math.min(scaleX, scaleY);
    scale = clamp(scale, CONFIG.TABLE.MIN_SCALE, maxScale);

    if (scale > CONFIG.TABLE.MIN_SCALE) {
      scale = Math.max(
        CONFIG.TABLE.MIN_SCALE,
        scale * CONFIG.TABLE.SCALE_ADJUSTMENT
      );
    }

    return scale;
  }
}

export class TableLayout {
  #cache;
  #measurement;
  #optimizer;
  #scaler;

  constructor() {
    this.#cache = new LRUCache(CONFIG.CACHE.MAX_TABLE_LAYOUT_CACHE);
    this.#measurement = new TableMeasurement();
    this.#optimizer = new ColumnOptimizer();
    this.#scaler = new CellScaler();
  }

  clearCache() {
    this.#cache.clear();
  }

  optimizeTable(overlay) {
    const { box, table } = this.#getTableElements(overlay);
    if (!box || !table) return;

    const dimensions = this.#getDimensions(overlay, box);
    if (!this.#isValidDimensions(dimensions)) return;

    const data = this.#parseTableData(table);
    const cacheKey = this.#generateCacheKey(dimensions, data);

    let solution = this.#cache.get(cacheKey);
    if (!solution) {
      solution = this.#optimizeLayout(data, dimensions);
      this.#cache.set(cacheKey, solution);
    }

    this.#applyLayout(table, box, solution, data.cells);
  }

  #getTableElements(overlay) {
    const box = overlay.querySelector(".overlay-text");
    const table = box?.querySelector(".data-table");
    return { box, table };
  }

  #getDimensions(overlay, box) {
    return {
      width: box.clientWidth,
      height:
        parseFloat(overlay.dataset.targetHeight) || overlay.clientHeight,
    };
  }

  #isValidDimensions({ width, height }) {
    return width > 0 && height > 0;
  }

  #generateCacheKey({ width, height }, { rows, cols, cells }) {
    const contentHash = JSON.stringify(cells).length;
    return `table:${width | 0}x${height | 0}:${rows}x${cols}:${contentHash}`;
  }

  #parseTableData(table) {
    const rows = Array.from(table.querySelectorAll("tr"));
    const cells = rows.map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) => ({
        text: this.#extractCellText(cell),
        isHeader: cell.tagName === "TH",
      }))
    );

    return {
      cells,
      rows: cells.length,
      cols: Math.max(0, ...cells.map((r) => r.length)),
    };
  }

  #extractCellText(cell) {
    const html = cell.innerHTML.trim();
    const withNewlines = html.replace(CONFIG.REGEX.BR_TAG, "\n");
    const temp = document.createElement("div");
    temp.innerHTML = withNewlines;
    return temp.textContent || "";
  }

  #optimizeLayout(data, dimensions) {
    const { cells, rows, cols } = data;
    const { width, height } = dimensions;

    const availWidth = width - (cols + 1) * CONFIG.TABLE.BORDER_WIDTH;
    const availHeight = height - (rows + 1) * CONFIG.TABLE.BORDER_WIDTH;

    const colWidths = this.#optimizer.calculateInitialWidths(
      cells,
      cols,
      availWidth
    );
    const rowHeight = availHeight / rows;

    const initialFontSize = this.#calculateInitialFontSize(
      availWidth,
      availHeight,
      cells
    );
    const optimized = this.#findOptimalFontSize(
      cells,
      colWidths,
      rowHeight,
      initialFontSize
    );

    return {
      fontSize: optimized.fontSize,
      colWidths: optimized.colWidths,
      rowHeight,
    };
  }

  #calculateInitialFontSize(width, height, cells) {
    const totalChars = cells.flat().reduce((sum, c) => sum + c.text.length, 1);
    const fontSize = Math.sqrt((width * height) / totalChars) * 1.2;
    return Math.max(
      CONFIG.OVERLAY.MIN_FONT_SIZE,
      Math.min(CONFIG.OVERLAY.MAX_FONT_SIZE, fontSize)
    );
  }

  #findOptimalFontSize(cells, colWidths, rowHeight, initialSize) {
    let fontSize = initialSize;
    let bestFontSize = CONFIG.OVERLAY.MIN_FONT_SIZE;
    let bestColWidths = [...colWidths];

    for (let iter = 0; iter < CONFIG.TABLE.MAX_ITERATIONS; iter++) {
      const measurements = this.#measurement.measureAll(
        cells,
        fontSize,
        colWidths,
        rowHeight
      );

      const fits = measurements.every((row) =>
        row.every((cell) => cell.fitsWidth && cell.fitsHeight)
      );

      if (fits) {
        if (fontSize > bestFontSize) {
          bestFontSize = fontSize;
          bestColWidths = [...colWidths];
        }

        const nextSize = Math.min(
          CONFIG.OVERLAY.MAX_FONT_SIZE,
          fontSize * CONFIG.TABLE.SCALE_FACTOR
        );
        if (nextSize === fontSize) break;
        fontSize = nextSize;
      } else {
        const reducedSize = fontSize * CONFIG.TABLE.REDUCE_FACTOR;
        if (reducedSize >= CONFIG.OVERLAY.MIN_FONT_SIZE) {
          fontSize = reducedSize;
          continue;
        }

        const improved = this.#optimizer.redistribute(colWidths, measurements);
        if (!improved) break;
      }
    }

    return {
      fontSize: bestFontSize,
      colWidths: bestColWidths,
    };
  }

  #applyLayout(table, box, solution, cells) {
    const { fontSize, colWidths, rowHeight } = solution;

    box.style.fontSize = toPx(fontSize);
    this.#applyColumnWidths(table, colWidths);
    this.#applyRowHeights(table, rowHeight);

    table.offsetHeight;

    this.#scaler.scaleCells(table, cells, fontSize, colWidths, rowHeight);
  }

  #applyColumnWidths(table, colWidths) {
    let colgroup = table.querySelector("colgroup");
    if (!colgroup) {
      colgroup = document.createElement("colgroup");
      table.insertBefore(colgroup, table.firstChild);
    }

    const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

    while (colgroup.children.length < colWidths.length) {
      colgroup.appendChild(document.createElement("col"));
    }
    while (colgroup.children.length > colWidths.length) {
      colgroup.removeChild(colgroup.lastChild);
    }

    colWidths.forEach((width, i) => {
      const percentage = (width / totalWidth) * 100;
      colgroup.children[i].style.width = `${percentage.toFixed(4)}%`;
    });
  }

  #applyRowHeights(table, rowHeight) {
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      row.style.height = toPx(rowHeight);
      Array.from(row.children).forEach((cell) => {
        cell.style.height = toPx(rowHeight);
      });
    });
  }
}