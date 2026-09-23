import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@liganer/shared/saved-list.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
