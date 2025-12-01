import { CONFIG } from "../config.js";

export class FileHandler {
  #app;

  constructor(app) {
    this.#app = app;
  }

  attachFileInputs() {
    const pdfInput = document.getElementById("file-input");
    const jsonInput = document.getElementById("json-input");

    if (pdfInput) {
      pdfInput.addEventListener("change", (e) => this.#handlePDFInput(e));
    }

    if (jsonInput) {
      jsonInput.addEventListener("change", (e) => this.#handleJSONInput(e));
    }
  }

  #handlePDFInput(event) {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;
    this.#app.handlePDFUpload(file);
  }

  #handleJSONInput(event) {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".json")) return;
    this.#app.handleJSONUpload(file);
  }
}