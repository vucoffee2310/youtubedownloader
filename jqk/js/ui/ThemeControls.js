import { CONFIG } from "../config.js";
import { debounce, calculateBrightness, rgbToString } from "../utils.js";
export class ThemeControls {
  #state;
  #fontCalc;
  #elements;
  constructor(stateManager, fontCalc) {
    this.#state = stateManager;
    this.#fontCalc = fontCalc;
    this.#elements = {};
  }
  initialize() {
    this.#cacheElements();
    this.#populatePalettes();
    this.#attachSliderListeners();
    this.#setupPaletteSelector();
    this.#applyPalette(CONFIG.DEFAULT_PALETTE);
  }
  #cacheElements() {
    this.#elements = {
      opacity: document.getElementById("opacity-slider"),
      opacityVal: document.getElementById("opacity-value"),
      brightness: document.getElementById("brightness-slider"),
      brightnessVal: document.getElementById("brightness-value"),
      spacing: document.getElementById("spacing-slider"),
      spacingVal: document.getElementById("spacing-value"),
      paletteContainer: document.getElementById("palette-container"),
    };
  }
  #attachSliderListeners() {
    const {
      opacity,
      opacityVal,
      brightness,
      brightnessVal,
      spacing,
      spacingVal,
    } = this.#elements;
    const bindSlider = (slider, display, format, handler) => {
      if (!slider || !display) return;
      const updateDisplay = () => {
        display.textContent = format(slider.value);
      };
      const debouncedHandler = debounce(() => {
        updateDisplay();
        handler();
      }, CONFIG.UI.DEBOUNCE_SLIDER);
      slider.addEventListener("input", debouncedHandler);
      updateDisplay();
    };
    bindSlider(opacity, opacityVal, (v) => `${v}%`, () => this.#applyOpacity());
    bindSlider(brightness, brightnessVal, (v) => `${v}%`, () =>
      this.#applyBrightness()
    );
    bindSlider(spacing, spacingVal, (v) => `${(v / 100).toFixed(2)}em`, () =>
      this.#updateSpacing()
    );
  }
  #populatePalettes() {
    const container = this.#elements.paletteContainer;
    if (!container) return;
    
    // The CSS for .palette-swatch is now handled in controls.css
    container.innerHTML = Object.entries(CONFIG.COLOR_PALETTES)
      .map(([key, [bg, text]]) => {
        const active = key === CONFIG.DEFAULT_PALETTE ? " active" : "";
        const bgColor = `rgb(${bg[0]},${bg[1]},${bg[2]})`;
        const textColor = `rgb(${text[0]},${text[1]},${text[2]})`;
        return `
          <div class="palette-swatch${active}"
               data-palette="${key}"
               title="${key}"
               style="background:${bgColor};color:${textColor}">
            <span>Aa</span>
          </div>
        `;
      })
      .join("");
  }
  #setupPaletteSelector() {
    const container = this.#elements.paletteContainer;
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
    if (this.#elements.opacity) {
      this.#elements.opacity.value = opacity;
      this.#elements.opacityVal.textContent = `${opacity}%`;
    }
    const brightnessValue = Math.round(
      calculateBrightness(text[0], text[1], text[2]) * 100
    );
    if (this.#elements.brightness) {
      this.#elements.brightness.value = brightnessValue;
      this.#elements.brightnessVal.textContent = `${brightnessValue}%`;
    }
    this.#applyOpacity();
    this.#applyBrightness();
  }
  #applyOpacity() {
    const value = parseInt(this.#elements.opacity?.value) || 97;
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
    const value = parseInt(this.#elements.brightness?.value) || 50;
    const adjusted = Math.round(value * 2.55);
    document.body.style.setProperty(
      "--overlay-text",
      rgbToString(adjusted, adjusted, adjusted)
    );
  }
  #updateSpacing() {
    const value = parseInt(this.#elements.spacing?.value) || 30;
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