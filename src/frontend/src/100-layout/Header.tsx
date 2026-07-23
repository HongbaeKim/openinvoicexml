import type { JSX } from "react";
import { useLanguage } from "../000-core/i18n";

export function Header(): JSX.Element {
  const { lang, setLang } = useLanguage();

  return (
    <header className="border-b border-border">
      <div className="flex items-center justify-between px-5 py-4">
        <a
          href="index.html"
          className="inline-flex items-center gap-2 text-sm font-semibold text-text no-underline hover:underline"
        >
          <img src="/logo/OIX.png" alt="" className="h-6 w-6 rounded-full" />
          OpenInvoiceXML
        </a>
        <div className="flex items-center gap-1 text-xs" role="group" aria-label="Language">
          <button
            type="button"
            onClick={() => setLang("de")}
            aria-pressed={lang === "de"}
            className={`rounded px-1.5 py-1 ${
              lang === "de" ? "font-semibold text-text" : "text-text-muted hover:text-text"
            }`}
          >
            DE
          </button>
          <span aria-hidden="true" className="text-text-muted">
            /
          </span>
          <button
            type="button"
            onClick={() => setLang("en")}
            aria-pressed={lang === "en"}
            className={`rounded px-1.5 py-1 ${
              lang === "en" ? "font-semibold text-text" : "text-text-muted hover:text-text"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
