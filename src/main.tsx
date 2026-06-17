import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { getAuthMode } from "@/lib/auth-config";
import { seedDemo } from "@/lib/store";
import "./index.css";

if (getAuthMode() === "local") {
  try {
    seedDemo();
  } catch (e) {
    console.warn("seedDemo skipped:", e);
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
