import { CONFIG } from "../config.js";
import { escapeHtml } from "../utils.js";
import { codeFormatter } from "../services/CodeFormatting.js";

class TextFormatter {
  format(text) {
    if (!text) return "";
    if (text.includes('<div class="merged-text-block">')) {
      return text;
    }
    return escapeHtml(text);
  }
}

class CodeFormatter {
  format(text) {
    if (!text) return "";
    const formatted = codeFormatter.formatSync(text);
    return escapeHtml(formatted || text);
  }
}

class ListFormatter {
  format(text) {
    if (!text) return "";
    if (text.includes('<div class="list-item">')) {
      return text;
    }
    return text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => `<div class="list-item">${escapeHtml(line)}</div>`)
      .join("");
  }
}

class TableBuilder {
  build(rows) {
    const cols = Math.max(0, ...rows.map((r) => r.length));
    const colWidths = this.#calculateColumnWidths(rows, cols);
    const percentages = this.#widthsToPercentages(colWidths);
    const colgroup = this.#buildColgroup(percentages);
    const thead = this.#buildTableHead(rows[0] || [], cols);
    const tbody = this.#buildTableBody(rows.slice(1), cols);
    return `<table class="data-table">${colgroup}${thead}${tbody}</table>`;
  }
  #calculateColumnWidths(rows, cols) {
    const scores = new Array(cols).fill(1);
    const HEAD_BOOST = 1.15;
    rows.forEach((row, rowIdx) => {
      for (let colIdx = 0; colIdx < cols; colIdx++) {
        const raw = String(row[colIdx] ?? "");
        const maxLine =
          raw
            .split(/\r?\n/)
            .reduce((max, str) => Math.max(max, str.trim().length), 0) || 1;
        const boost = rowIdx === 0 ? HEAD_BOOST : 1;
        scores[colIdx] = Math.max(scores[colIdx], maxLine * boost);
      }
    });
    return scores.map((score) => Math.sqrt(score) + 1e-3);
  }
  #widthsToPercentages(weights) {
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    let percentages = weights.map((w) => (w / sum) * 100);
    const cols = weights.length;
    const minPct = Math.max(100 / (cols * 2.5), 6);
    const maxPct = 60;
    percentages = this.#enforceMinimums(percentages, minPct);
    percentages = this.#enforceMaximums(percentages, maxPct);
    percentages = this.#normalize(percentages);
    return percentages;
  }
  #enforceMinimums(percentages, minPct) {
    const fixed = new Set();
    let fixedSum = 0;
    percentages.forEach((pct, i) => {
      if (pct < minPct) {
        percentages[i] = minPct;
        fixed.add(i);
        fixedSum += minPct;
      }
    });
    const remain = Math.max(0, 100 - fixedSum);
    if (remain === 0) {
      return new Array(percentages.length).fill(100 / percentages.length);
    }
    const freeIndices = [];
    let freeSum = 0;
    percentages.forEach((pct, i) => {
      if (!fixed.has(i)) {
        freeIndices.push(i);
        freeSum += pct;
      }
    });
    if (freeSum > 0) {
      freeIndices.forEach((i) => {
        percentages[i] = remain * (percentages[i] / freeSum);
      });
    }
    return percentages;
  }
  #enforceMaximums(percentages, maxPct) {
    let excess = 0;
    const flexible = [];
    percentages.forEach((pct, i) => {
      if (pct > maxPct) {
        excess += pct - maxPct;
        percentages[i] = maxPct;
      } else {
        flexible.push(i);
      }
    });
    if (excess > 0 && flexible.length > 0) {
      const headroom = flexible.map((i) => maxPct - percentages[i]);
      const sumH = headroom.reduce((a, b) => a + b, 0) || 1;
      flexible.forEach((i, k) => {
        percentages[i] += excess * (headroom[k] / sumH);
      });
    }
    return percentages;
  }
  #normalize(percentages) {
    const norm = 100 / (percentages.reduce((a, b) => a + b, 0) || 1);
    return percentages.map((p) => p * norm);
  }
  #buildColgroup(percentages) {
    const cols = percentages
      .map((pct) => `<col style="width:${pct.toFixed(4)}%;">`)
      .join("");
    return `<colgroup>${cols}</colgroup>`;
  }
  #buildTableHead(headerRow, cols) {
    const cells = Array.from({ length: cols }, (_, j) =>
      this.#buildCell("th", headerRow[j])
    ).join("");
    return `<thead><tr>${cells}</tr></thead>`;
  }
  #buildTableBody(bodyRows, cols) {
    const rows = bodyRows
      .map((row) => {
        const cells = Array.from({ length: cols }, (_, j) =>
          this.#buildCell("td", row[j])
        ).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<tbody>${rows}</tbody>`;
  }
  #buildCell(tag, content) {
    const text =
      escapeHtml(String(content ?? "")).replace(/\n/g, "<br>") || "&nbsp;";
    return `<${tag}>${text}</${tag}>`;
  }
}

class TableFormatter {
  #builder;
  constructor() {
    this.#builder = new TableBuilder();
  }
  format(text, info) {
    let data = info.tableData;
    if (!data) {
      try {
        data = JSON.parse(text);
      } catch {
        return text;
      }
    }
    if (!Array.isArray(data) || !data.length) return text;
    const rows = data.filter((r) => Array.isArray(r));
    if (!rows.length) return text;
    return this.#builder.build(rows);
  }
}

class ImageFormatter {
  format() {
    return '<div class="image-placeholder">[Image]</div>';
  }
}

class FormatterRegistry {
  #formatters;
  constructor() {
    this.#formatters = new Map([
      [CONFIG.CONTENT_TYPES.TEXT, new TextFormatter()],
      [CONFIG.CONTENT_TYPES.CODE, new CodeFormatter()],
      [CONFIG.CONTENT_TYPES.LIST, new ListFormatter()],
      [CONFIG.CONTENT_TYPES.TABLE, new TableFormatter()],
      [CONFIG.CONTENT_TYPES.IMAGE, new ImageFormatter()],
    ]);
  }
  getFormatter(type) {
    return (
      this.#formatters.get(type) ||
      this.#formatters.get(CONFIG.CONTENT_TYPES.TEXT)
    );
  }
  registerFormatter(type, formatter) {
    this.#formatters.set(type, formatter);
  }
  hasFormatter(type) {
    return this.#formatters.has(type);
  }
}

export class ContentRenderer {
  #registry;
  constructor() {
    this.#registry = new FormatterRegistry();
  }
  formatContent(info) {
    const { text, type } = info;
    const formatter = this.#registry.getFormatter(type);
    return formatter.format(text, info);
  }
  extractTableToJSON(root) {
    const table = root.querySelector(".data-table");
    if (!table) return "[]";
    const rows = Array.from(table.querySelectorAll("tr"));
    return JSON.stringify(
      rows.map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) => {
          const div = document.createElement("div");
          div.innerHTML = cell.innerHTML
            .trim()
            .replace(CONFIG.REGEX.BR_TAG, "\n");
          return div.textContent || "";
        })
      )
    );
  }
}
