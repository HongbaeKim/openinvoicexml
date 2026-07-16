import React from "react";
import ReactDOM from "react-dom/client";
import { Impressum } from "./200-pages/Impressum";
import { LanguageProvider } from "./000-core/i18n";
import "./000-core/style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <Impressum />
    </LanguageProvider>
  </React.StrictMode>,
);
