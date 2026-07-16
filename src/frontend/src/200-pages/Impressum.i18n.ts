import type { Lang } from "../000-core/i18n";

export const impressumDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    responsibleHeading: string;
    contactHeading: string;
    emailLabel: string;
    fundingHeading: string;
    funding: { before: string; linkText: string; after: string };
  }
> = {
  de: {
    metaTitle: "Impressum — openinvoicexml",
    metaDescription: "Impressum und Anbieterkennzeichnung von openinvoicexml gemäß § 5 DDG.",
    heading: "Impressum",
    responsibleHeading: "Verantwortlich für den Inhalt",
    contactHeading: "Kontakt",
    emailLabel: "E-Mail:",
    fundingHeading: "Projektförderung",
    funding: {
      before: "openinvoicexml wird gefördert von ",
      linkText: "Prototype Fund",
      after: ", einem Programm des Bundesministeriums für Forschung, Technologie und Raumfahrt (BMFTR), verwaltet von der Open Knowledge Foundation Deutschland.",
    },
  },
  en: {
    metaTitle: "Impressum — openinvoicexml",
    metaDescription: "Legal notice (Impressum) for openinvoicexml, required under German law (§ 5 DDG).",
    heading: "Impressum",
    responsibleHeading: "Responsible for content",
    contactHeading: "Contact",
    emailLabel: "Email:",
    fundingHeading: "Project funding",
    funding: {
      before: "openinvoicexml is funded by ",
      linkText: "Prototype Fund",
      after: ", a program of the Federal Ministry of Research, Technology and Space (BMFTR), managed by the Open Knowledge Foundation Germany.",
    },
  },
};
