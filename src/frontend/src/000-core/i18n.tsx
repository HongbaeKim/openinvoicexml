import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "de" | "en";

const STORAGE_KEY = "oix-lang";
const DEFAULT_LANG: Lang = "de";

function getStoredLang(): Lang {
  return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : DEFAULT_LANG;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }): JSX.Element {
  const [lang, setLang] = useState<Lang>(getStoredLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

export function useTranslation<T>(dictionary: Record<Lang, T>): { t: T } & LanguageContextValue {
  const { lang, setLang } = useLanguage();
  return { t: dictionary[lang], lang, setLang };
}

export function usePageMeta(meta: { title: string; description?: string }): void {
  useEffect(() => {
    document.title = meta.title;
    if (meta.description) {
      document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    }
  }, [meta.title, meta.description]);
}
