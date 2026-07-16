import React from "react";
import ReactDOM from "react-dom/client";
import { BetaPage } from "./800-beta/BetaPage";
import { LanguageProvider } from "./000-core/i18n";
import "./000-core/style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <BetaPage />
    </LanguageProvider>
  </React.StrictMode>,
);
