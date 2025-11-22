import { PDFOverlayApp } from "./app/App.js";
import { jsonData } from "./data.js";
import { codeFormatter } from "./services/CodeFormatting.js";

const initializeApp = async () => {
  try {
    await codeFormatter.initialize();
    new PDFOverlayApp(jsonData);
  } catch (error) {
    console.error("Application initialization failed:", error);
    alert("Failed to initialize application. Please refresh the page.");
  }
};
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
