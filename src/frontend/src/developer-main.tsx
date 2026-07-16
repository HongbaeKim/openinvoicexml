import React from "react";
import ReactDOM from "react-dom/client";
import { DeveloperPage } from "./900-developer/DeveloperPage";
import { LanguageProvider } from "./000-core/i18n";
import "./000-core/style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <DeveloperPage />
    </LanguageProvider>
  </React.StrictMode>,
);
