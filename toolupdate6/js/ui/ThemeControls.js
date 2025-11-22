import { CONFIG } from "../config.js";
import { debounce, calculateBrightness, rgbToString } from "../utils.js";

class PaletteRenderer {
  renderPalettes(palettes, activePalette) {
    return Object.entries(palettes)
      .map(([key, [bg, text]]) => {
        const isActive = key === activePalette;
        return this.#renderSwatch(key, bg, text, isActive);
      })
      .join("");
  }
  #renderSwatch(key, bg, text, isActive) {
    const activeClass = isActive ? " active" : "";
    const bgColor = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
    const textColor = `rgb(${text[0]},${text[1]},${text[2]})`;
    return `
      <div class="palette-swatch${activeClass}"
           data-palette="${key}"
           title="${key}"
           style="background:${bgColor};color:${textColor}">
        <span>Aa</span>
      </div>
    `;
  }
}

class SliderControl {
  #config;
  #slider;
  #valueDisplay;
  constructor(config) {
    this.#config = config;
    this.#slider = null;
    this.#valueDisplay = null;
  }
  initialize() {
    this.#slider = document.getElementById(this.#config.element);
    this.#valueDisplay = document.getElementById(this.#config.valueDisplay);
    if (!this.#slider || !this.#valueDisplay) return;
    const debouncedHandler = debounce(this.#config.handler, this.#config.delay);
    this.#slider.addEventListener("input", (e) => {
      this.#updateDisplay(e.target.value);
      debouncedHandler();
    });
  }
  getValue() {
    return parseInt(this.#slider?.value || 0);
  }
  setValue(value) {
    if (this.#slider) {
      this.#slider.value = value;
      this.#updateDisplay(value);
    }
  }
  #updateDisplay(value) {
    if (this.#valueDisplay && this.#config.formatter) {
      this.#valueDisplay.textContent = this.#config.formatter(value);
    }
  }
}

export class ThemeControls {
  #state;
  #fontCalc;
  #paletteRenderer;
  #sliders;
  constructor(stateManager, fontCalc) {
    this.#state = stateManager;
    this.#fontCalc = fontCalc;
    this.#paletteRenderer = new PaletteRenderer();
    this.#sliders = new Map();
  }
  initialize() {
    this.#populatePalettes();
    this.#setupSliders();
    this.#setupPaletteSelector();
    this.#applyPalette(CONFIG.DEFAULT_PALETTE);
  }
  #populatePalettes() {
    const container = document.getElementById("palette-container");
    if (!container) return;
    container.innerHTML = this.#paletteRenderer.renderPalettes(
      CONFIG.COLOR_PALETTES,
      CONFIG.DEFAULT_PALETTE
    );
  }
  #setupSliders() {
    this.#createSlider("opacity", {
      element: "opacity-slider",
      valueDisplay: "opacity-value",
      formatter: (val) => `${val}%`,
      handler: () => this.#applyOpacity(),
      delay: CONFIG.UI.DEBOUNCE_SLIDER,
    });
    this.#createSlider("brightness", {
      element: "brightness-slider",
      valueDisplay: "brightness-value",
      formatter: (val) => `${val}%`,
      handler: () => this.#applyBrightness(),
      delay: CONFIG.UI.DEBOUNCE_SLIDER,
    });
    this.#createSlider("spacing", {
      element: "spacing-slider",
      valueDisplay: "spacing-value",
      formatter: (val) => `${(val / 100).toFixed(2)}em`,
      handler: () => this.#updateSpacing(),
      delay: CONFIG.UI.DEBOUNCE_SLIDER,
    });
  }
  #createSlider(name, config) {
    const slider = new SliderControl(config);
    slider.initialize();
    this.#sliders.set(name, slider);
  }
  #setupPaletteSelector() {
    const container = document.getElementById("palette-container");
    if (!container) return;
    container.addEventListener("click", (e) => {
      const swatch = e.target.closest(".palette-swatch");
      if (!swatch) return;
      document
        .querySelector(".palette-swatch.active")
        ?.classList.remove("active");
      swatch.classList.add("active");
      this.#state.activePalette = swatch.dataset.palette;
      this.#applyPalette(swatch.dataset.palette);
    });
  }
  #applyPalette(paletteKey) {
    const palette = CONFIG.COLOR_PALETTES[paletteKey];
    if (!palette) return;
    const [bg, text, border, opacity] = palette;
    this.#sliders.get("opacity")?.setValue(opacity);
    const brightness = calculateBrightness(text[0], text[1], text[2]);
    const brightnessValue = Math.round(brightness * 100);
    this.#sliders.get("brightness")?.setValue(brightnessValue);
    this.#applyOpacity();
    this.#applyBrightness();
  }
  #applyOpacity() {
    const value = this.#sliders.get("opacity")?.getValue() || 97;
    const palette = CONFIG.COLOR_PALETTES[this.#state.activePalette];
    if (!palette) return;
    const [bg, , border] = palette;
    const root = document.body.style;
    root.setProperty(
      "--overlay-bg",
      rgbToString(bg[0], bg[1], bg[2], value / 100)
    );
    root.setProperty(
      "--overlay-border",
      rgbToString(border[0], border[1], border[2])
    );
  }
  #applyBrightness() {
    const value = this.#sliders.get("brightness")?.getValue() || 50;
    const adjusted = Math.round(value * 2.55);
    document.body.style.setProperty(
      "--overlay-text",
      rgbToString(adjusted, adjusted, adjusted)
    );
  }
  #updateSpacing() {
    const value = this.#sliders.get("spacing")?.getValue() || 30;
    const emValue = value / 100;
    document.body.style.setProperty("--paragraph-spacing", `${emValue}em`);
    this.#fontCalc.clearCache();
    requestAnimationFrame(() => {
      document.querySelectorAll(".overlay").forEach((overlay) => {
        this.#fontCalc.calculateOptimalSize(overlay);
      });
    });
  }
}
