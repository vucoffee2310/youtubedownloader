import { forceUIUpdate, toPx } from "../utils.js";
import { CONFIG } from "../config.js";

export class Exporters {
  constructor(pdf) {
    this.pdf = pdf;
  }

  async html(name) {
    await forceUIUpdate();
    try {
      const mainFontBase64 = await this.pdf.loadFont();
      const body = await this.#generateBodyHTML();
      const doc = this.#buildHTMLDocument(name, mainFontBase64, body);
      const blob = new Blob([doc], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${name}_view.html`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("HTML Export Error:", error);
      alert(`Error saving as HTML: ${error.message}`);
    }
  }

  async print() {
    await forceUIUpdate();
    try {
      await this.pdf.renderAllQueuedPages();
      await new Promise((r) => setTimeout(r, 100));
      await forceUIUpdate();
      window.print();
    } catch (error) {
      console.error("Print Error:", error);
      alert("Could not prepare for print.");
    }
  }

  async #generateBodyHTML() {
    const wrappers = Array.from(document.querySelectorAll(".page-wrapper"));
    const htmls = [];
    for (let i = 0; i < wrappers.length; i += 10) {
      const segment = wrappers.slice(i, i + 10);
      const results = await Promise.all(
        segment.map((w, idx) => this.#generatePageHTML(w, i + idx + 1))
      );
      htmls.push(...results);
      if (i % 30 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    return htmls.filter(Boolean).join("\n");
  }

  async #generatePageHTML(wrapper, pageNum) {
    const canvas = wrapper.querySelector("canvas");
    if (!canvas) return "";
    const imageDataUrl = await this.#canvasToDataURL(canvas);
    const overlaysHTML = Array.from(wrapper.querySelectorAll(".overlay"))
      .map((o) => this.#extractOverlayHTML(o, wrapper))
      .filter(Boolean)
      .join("\n    ");
    const { clientWidth, clientHeight } = wrapper;
    return `<div class="page-wrapper" style="position:relative;width:${toPx(
      clientWidth
    )};height:${toPx(clientHeight)};aspect-ratio:${
      canvas.width / canvas.height
    };margin:0 auto 10px;box-shadow:0 2px 10px rgba(0,0,0,0.3);line-height:0;"><img src="${imageDataUrl}" alt="PDF Page ${pageNum}" loading="lazy" style="display:block;width:100%;height:auto;">${overlaysHTML}</div>`;
  }

  #extractOverlayHTML(overlay, wrapper) {
    const textEl = overlay.querySelector(".overlay-text");
    if (!textEl) return "";
    const oStyle = getComputedStyle(overlay);
    const tStyle = getComputedStyle(textEl);
    const wRect = wrapper.getBoundingClientRect();
    const oRect = overlay.getBoundingClientRect();

    const classes = ["overlay"];
    ["single-line-layout", "content-list", "content-table"].forEach((c) => {
      if (overlay.classList.contains(c)) classes.push(c);
    });

    const overlayStyles = `position:absolute;left:${toPx(
      oRect.left - wRect.left
    )};top:${toPx(oRect.top - wRect.top)};width:${toPx(
      oRect.width
    )};height:${toPx(oRect.height)};background-color:${
      oStyle.backgroundColor
    };border:${oStyle.borderWidth} solid ${oStyle.borderColor};border-radius:${
      oStyle.borderRadius
    };color:${tStyle.color};font-size:${tStyle.fontSize};font-family:${
      tStyle.fontFamily
    };font-weight:${tStyle.fontWeight};line-height:${
      tStyle.lineHeight
    };padding:${oStyle.padding};opacity:${
      oStyle.opacity
    };display:flex;flex-direction:column;overflow:hidden;white-space:pre-wrap;word-wrap:break-word;`;
    const textStyles = `text-align:${tStyle.textAlign};letter-spacing:${tStyle.letterSpacing};width:100%;`;

    return `<div class="${classes.join(
      " "
    )}" style="${overlayStyles}"><div class="overlay-text" style="${textStyles}">${
      textEl.innerHTML || ""
    }</div></div>`;
  }

  async #canvasToDataURL(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Canvas to Blob failed."));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        CONFIG.EXPORT.HTML_IMAGE_FORMAT,
        CONFIG.EXPORT.HTML_IMAGE_QUALITY
      );
    });
  }

  #buildHTMLDocument(title, mainFontBase64, body) {
    const fontFace = mainFontBase64
      ? `@font-face{font-family:'${CONFIG.FONT.NAME}';src:url(data:font/ttf;base64,${mainFontBase64}) format('truetype');font-weight:100 900;font-style:normal;font-display:swap;}`
      : "";
    const css = `${fontFace}*{box-sizing:border-box;margin:0;padding:0;}body{margin:0;background:#e9e9e9;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;}main{margin:0 auto;max-width:100%;padding:20px 0;}.page-wrapper{position:relative;margin:0 auto 20px;box-shadow:0 2px 10px rgba(0,0,0,0.3);line-height:0;background:#fff;}.overlay{position:absolute;border:1px solid;font-family:'${CONFIG.FONT.NAME}',sans-serif;line-height:1.15;overflow:hidden;display:flex;flex-direction:column;white-space:pre-wrap;word-wrap:break-word;border-radius:3px;padding:1px;}.overlay:hover{box-shadow:0 0 12px rgba(52,152,219,.8);transform:scale(1.01);z-index:200;}.overlay-text{cursor:text;user-select:text;}.overlay.single-line-layout{justify-content:center;align-items:center;}.overlay.single-line-layout .overlay-text{width:auto;text-align:left;align-self:center;}.overlay.content-list{justify-content:flex-start;align-items:flex-start;}.overlay.content-list .overlay-text{width:100%;text-align:left;}.list-item{margin-bottom:.4em;text-align:left;line-height:1.3;}.list-item:last-child{margin-bottom:0;}.overlay.content-table{overflow:hidden;padding:4px;justify-content:flex-start;align-items:flex-start;}.overlay.content-table .overlay-text{width:100%;height:100%;overflow:hidden;text-align:left;line-height:1.25;padding:0;}.data-table{width:100%;height:100%;border-collapse:collapse;font-size:inherit;line-height:inherit;border:1px solid;border-color:inherit;color:inherit;table-layout:fixed;}.data-table th,.data-table td{padding:4px;border:1px solid;border-color:inherit;text-align:left;vertical-align:middle;word-break:break-word;font-size:inherit;overflow:hidden;line-height:1.25;}.data-table th{font-weight:700;background:rgba(0,0,0,.15);white-space:normal;}.data-table td{background:rgba(0,0,0,.05);}.data-table tr:nth-child(even) td{background:rgba(0,0,0,.08);}.merged-text-block{text-indent:1.5em;}.merged-text-block:not(:last-child){margin-bottom:0.4em;}@media print{body{background:none;}main{margin:0;padding:0;}.page-wrapper{box-shadow:none;margin:0;break-inside:avoid;}.page-wrapper+.page-wrapper{break-before:page;}.overlay,canvas{print-color-adjust:exact;-webkit-print-color-adjust:exact;}.data-table{page-break-inside:avoid;}@page{size:auto;margin:0;}}`;
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${title} - View</title><style>${css}</style></head><body><main>${body}</main></body></html>`;
  }
}
