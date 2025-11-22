import { CONFIG } from "../config.js";

class LanguageDetector {
  detect(code) {
    const trimmed = code.trim();
    if (this.#isPython(trimmed)) return "python";
    if (this.#isTypeScript(trimmed)) return "typescript";
    if (this.#isJavaScript(trimmed)) return "babel";
    if (this.#isHTML(trimmed)) return "html";
    if (this.#isCSS(trimmed)) return "css";
    if (this.#isJSON(trimmed)) return "json";
    return "babel";
  }
  #isPython(code) {
    return (
      CONFIG.REGEX.PYTHON.test(code) || CONFIG.REGEX.PYTHON_COLON.test(code)
    );
  }
  #isTypeScript(code) {
    return CONFIG.REGEX.TYPESCRIPT.test(code);
  }
  #isJavaScript(code) {
    return CONFIG.REGEX.JAVASCRIPT.test(code);
  }
  #isHTML(code) {
    return CONFIG.REGEX.HTML.test(code);
  }
  #isCSS(code) {
    return CONFIG.REGEX.CSS.test(code);
  }
  #isJSON(code) {
    if (!CONFIG.REGEX.JSON_START.test(code)) return false;
    try {
      JSON.parse(code);
      return true;
    } catch {
      return false;
    }
  }
}

class PythonFormatter {
  format(code) {
    let cleaned = this.#cleanSpacing(code);
    let normalized = this.#normalizeStructure(cleaned);
    let indented = this.#applyIndentation(normalized);
    let spaced = this.#addBlockSpacing(indented);
    return spaced;
  }
  #cleanSpacing(code) {
    return code
      .replace(/(\w+)\s+\.\s+(\w+)/g, "$1.$2")
      .replace(/\s*=\s*/g, " = ")
      .replace(/\s*:\s*/g, ": ")
      .replace(/[ \t]+/g, " ")
      .trim();
  }
  #normalizeStructure(code) {
    const lines = code.split("\n");
    const result = [];
    let buffer = "";
    let depth = { paren: 0, bracket: 0, brace: 0 };
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (!buffer) result.push("");
        continue;
      }
      this.#updateDepth(depth, trimmed);
      buffer = buffer ? `${buffer} ${trimmed}` : trimmed;
      if (this.#shouldFlushBuffer(buffer, depth)) {
        result.push(buffer);
        buffer = "";
      }
    }
    if (buffer) result.push(buffer);
    return result.join("\n");
  }
  #updateDepth(depth, line) {
    depth.paren +=
      (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length;
    depth.bracket +=
      (line.match(/\[/g) || []).length - (line.match(/\]/g) || []).length;
    depth.brace +=
      (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
  }
  #shouldFlushBuffer(buffer, depth) {
    return (
      depth.paren === 0 &&
      depth.bracket === 0 &&
      depth.brace === 0 &&
      !buffer.endsWith(",") &&
      !buffer.endsWith("(")
    );
  }
  #applyIndentation(code) {
    const lines = code.split("\n");
    const result = [];
    const INDENT = "    ";
    const stack = [0];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        result.push("");
        continue;
      }
      let level = stack[stack.length - 1];
      if (/^(elif|else|except|finally):/.test(line)) {
        if (stack.length > 1) {
          stack.pop();
          level = stack[stack.length - 1];
        }
      }
      result.push(INDENT.repeat(level) + line);
      if (line.endsWith(":") && !line.startsWith("#")) {
        stack.push(level + 1);
      }
      if (/^(return|break|continue|pass|raise)(\s|$)/.test(line)) {
        const nextLine = lines[i + 1]?.trim();
        if (
          nextLine &&
          (/^(def|class|elif|else|except|finally)/.test(nextLine) || !nextLine)
        ) {
          if (stack.length > 1) stack.pop();
        }
      }
    }
    return result.join("\n");
  }
  #addBlockSpacing(code) {
    const lines = code.split("\n");
    const result = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const prev = i > 0 ? lines[i - 1].trim() : "";
      const next = i < lines.length - 1 ? lines[i + 1].trim() : "";
      if (
        /^(class|def|async def)\s/.test(trimmed) &&
        !line.startsWith("    ")
      ) {
        if (prev && !prev.startsWith("#") && prev.length > 0) {
          result.push("");
        }
      }
      result.push(line);
      if (
        (trimmed.startsWith("import ") || trimmed.startsWith("from ")) &&
        next &&
        !next.startsWith("import") &&
        !next.startsWith("from") &&
        !next.startsWith("#")
      ) {
        result.push("");
      }
    }
    return result.join("\n").trim();
  }
}

export class CodeFormatter {
  #prettier;
  #plugins;
  #initialized;
  #pythonFormatter;
  #detector;
  constructor() {
    this.#prettier = null;
    this.#plugins = null;
    this.#initialized = false;
    this.#pythonFormatter = new PythonFormatter();
    this.#detector = new LanguageDetector();
  }
  async initialize() {
    if (this.#initialized) return true;
    try {
      await this.#waitForPrettier();
      this.#prettier = window.prettier;
      this.#plugins = [
        window.prettierPlugins?.babel,
        window.prettierPlugins?.estree,
        window.prettierPlugins?.html,
        window.prettierPlugins?.markdown,
        window.prettierPlugins?.postcss,
        window.prettierPlugins?.typescript,
      ].filter(Boolean);
      this.#initialized = true;
      return true;
    } catch (error) {
      console.warn("Prettier initialization failed:", error);
      return false;
    }
  }
  async format(code, options = {}) {
    if (!code) return code;
    const decoded = this.#decodeHTMLEntities(code);
    const parser = options.parser || this.#detector.detect(decoded);
    if (parser === "python") {
      return this.#pythonFormatter.format(decoded);
    }
    if (!this.#initialized) {
      await this.initialize();
    }
    if (!this.#initialized) {
      return this.#fallbackFormat(decoded, parser);
    }
    try {
      return (
        await this.#prettier.format(decoded, {
          parser,
          plugins: this.#plugins,
          printWidth: 80,
          tabWidth: 4,
          useTabs: false,
          semi: true,
          ...options,
        })
      ).trim();
    } catch (error) {
      return this.#fallbackFormat(decoded, parser);
    }
  }
  formatSync(code, options = {}) {
    if (!code) return code;
    const decoded = this.#decodeHTMLEntities(code);
    const parser = options.parser || this.#detector.detect(decoded);
    if (parser === "python") {
      return this.#pythonFormatter.format(decoded);
    }
    return this.#fallbackFormat(decoded, parser);
  }
  #decodeHTMLEntities(text) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
  }
  #fallbackFormat(code, parser) {
    if (parser === "python") {
      return this.#pythonFormatter.format(code);
    }
    return code
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim();
  }
  #waitForPrettier(timeout = 5000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (window.prettier && window.prettierPlugins) {
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error("Prettier load timeout"));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
}
export const codeFormatter = new CodeFormatter();
