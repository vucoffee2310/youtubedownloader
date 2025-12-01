import { CONFIG } from "../config.js";
import { escapeHtml } from "../utils.js";

const calculateColumnWidths = (rows, cols) => {
  const scores = new Array(cols).fill(1);
  rows.forEach((row, rowIdx) => {
    for (let colIdx = 0; colIdx < cols; colIdx++) {
      const maxLine =
        String(row[colIdx] ?? "")
          .split(/\r?\n/)
          .reduce((max, s) => Math.max(max, s.trim().length), 0) || 1;
      scores[colIdx] = Math.max(
        scores[colIdx],
        maxLine * (rowIdx === 0 ? 1.15 : 1)
      );
    }
  });
  return scores.map((s) => Math.sqrt(s) + 1e-3);
};

const widthsToPercentages = (weights, cols) => {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const minPct = Math.max(100 / (cols * 2.5), 6);
  let pcts = weights.map((w) =>
    Math.max(minPct, Math.min(60, (w / sum) * 100))
  );
  const total = pcts.reduce((a, b) => a + b, 0);
  return pcts.map((p) => (p / total) * 100);
};

const buildTable = (rows) => {
  if (!Array.isArray(rows) || !rows.length) return "";
  const cols = Math.max(0, ...rows.map((r) => r.length));
  const pcts = widthsToPercentages(calculateColumnWidths(rows, cols), cols);
  const colgroup = pcts
    .map((p) => `<col style="width:${p.toFixed(4)}%;">`)
    .join("");
  const headerCells = Array.from(
    { length: cols },
    (_, j) =>
      `<th>${
        escapeHtml(String(rows[0]?.[j] ?? "")).replace(/\n/g, "<br>") ||
        "&nbsp;"
      }</th>`
  ).join("");
  const bodyRows = rows
    .slice(1)
    .map(
      (row) =>
        `<tr>${Array.from(
          { length: cols },
          (_, j) =>
            `<td>${
              escapeHtml(String(row[j] ?? "")).replace(/\n/g, "<br>") ||
              "&nbsp;"
            }</td>`
        ).join("")}</tr>`
    )
    .join("");
  return `<table class="data-table"><colgroup>${colgroup}</colgroup><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
};

export const formatContent = (info) => {
  const { text, type, tableData } = info;
  switch (type) {
    case CONFIG.CONTENT_TYPES.IMAGE:
    case CONFIG.CONTENT_TYPES.CODE:
      return "";
    case CONFIG.CONTENT_TYPES.LIST:
      if (!text) return "";
      if (text.includes('<div class="list-item">')) return text;
      return text
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => `<div class="list-item">${escapeHtml(l)}</div>`)
        .join("");
    case CONFIG.CONTENT_TYPES.TABLE:
      let data = tableData;
      if (!data)
        try {
          data = JSON.parse(text);
        } catch {
          return text;
        }
      if (!Array.isArray(data) || !data.length) return text;
      return buildTable(data.filter((r) => Array.isArray(r))) || text;
    default:
      if (!text) return "";
      if (text.includes('<div class="merged-text-block">')) return text;
      return escapeHtml(text);
  }
};

export const extractTableToJSON = (root) => {
  const table = root.querySelector(".data-table");
  if (!table) return "[]";
  return JSON.stringify(
    Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) => {
        const div = document.createElement("div");
        div.innerHTML = cell.innerHTML
          .trim()
          .replace(CONFIG.REGEX.BR_TAG, "\n");
        return div.textContent || "";
      })
    )
  );
};
