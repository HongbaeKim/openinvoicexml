import type { Lang } from "../000-core/i18n";

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqDict: Record<Lang, FaqItem[]> = {
  de: [
    {
      question: "Was ist OpenInvoiceXML?",
      answer:
        "Eine Open-Source-TypeScript-Bibliothek, die Deutschland-konforme elektronische Rechnungen erzeugt — XRechnung UBL XML, CII XML und hybrides PDF/A-3 mit eingebettetem XML, einschließlich echtem Factur-X/ZUGFeRD.",
    },
    {
      question: "Warum brauche ich das ab 2028?",
      answer:
        "Ab 2028 müssen deutsche Unternehmen inländische B2B-Rechnungen grundsätzlich als strukturierte E-Rechnung ausstellen. OpenInvoiceXML hilft Entwickler:innen, dafür konforme Rechnungsdateien zu erstellen.",
    },
    {
      question: "Was ist der Unterschied zwischen XRechnung und ZUGFeRD/Factur-X?",
      answer:
        "XRechnung ist reines XML (UBL oder CII). ZUGFeRD/Factur-X ist ein hybrides PDF/A-3, in das dasselbe strukturierte XML eingebettet ist — dadurch bleibt es zusätzlich für Menschen lesbar.",
    },
    {
      question: "Ist es kostenlos und Open Source?",
      answer: "Ja, Apache-2.0-lizenziert, der Quellcode ist öffentlich auf GitHub verfügbar.",
    },
    {
      question: "Was wird noch nicht unterstützt?",
      answer:
        "Ein paar Randfälle sind noch offen — etwa bestimmte regionale USt-Sonderregelungen, historische Steuersätze und die vollständige Prüfung der §19-Umsatzschwellen. Die vollständige Liste steht in unserer Dokumentation auf GitHub.",
    },
  ],
  en: [
    {
      question: "What is OpenInvoiceXML?",
      answer:
        "An open-source TypeScript library that generates Germany-compliant electronic invoices — XRechnung UBL XML, CII XML, and hybrid PDF/A-3 with embedded XML, including genuine Factur-X/ZUGFeRD.",
    },
    {
      question: "Why do I need this starting in 2028?",
      answer:
        "From 2028, German businesses will generally need to issue structured e-invoices for domestic B2B transactions. OpenInvoiceXML helps developers create compliant invoice files for this requirement.",
    },
    {
      question: "What's the difference between XRechnung and ZUGFeRD/Factur-X?",
      answer:
        "XRechnung is XML-only (UBL or CII). ZUGFeRD/Factur-X is a hybrid PDF/A-3 with the same structured XML embedded inside it, so it stays human-readable too.",
    },
    {
      question: "Is it free and open source?",
      answer: "Yes — Apache-2.0 licensed, with the source publicly available on GitHub.",
    },
    {
      question: "What's not supported yet?",
      answer:
        "A few edge cases are still open — such as certain regional VAT special rules, historical tax rates, and full §19 small-business turnover-threshold checks. See our documentation on GitHub for the complete list.",
    },
  ],
};
