import React from "react";
import ReactDOM from "react-dom/client";
import { Privacy } from "./200-pages/Privacy";
import { LanguageProvider } from "./000-core/i18n";
import "./000-core/style.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <Privacy />
    </LanguageProvider>
  </React.StrictMode>,
);
