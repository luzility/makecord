import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary, reportError } from "./components/ErrorBoundary";
import "./styles.css";

window.addEventListener("error", (e) => reportError("window", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => reportError("promise", e.reason));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary level="app">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
