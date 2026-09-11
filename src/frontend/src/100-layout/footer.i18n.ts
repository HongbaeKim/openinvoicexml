import type { Lang } from "../000-core/i18n";

export const footerDict: Record<
  Lang,
  {
    privacy: string;
    impressum: string;
    project: string;
    license: string;
    github: string;
    funding: string;
    bmftrAlt: string;
    prototypeFundAlt: string;
    mastodonAria: string;
    linkedinAria: string;
    facebookAria: string;
    instagramAria: string;
    threadsAria: string;
  }
> = {
  de: {
    privacy: "Datenschutz",
    impressum: "Impressum",
    project: "Projekt",
    license: "Lizenz",
    github: "GitHub",
    funding: "Förderung",
    bmftrAlt: "Logo des Bundesministeriums für Forschung, Technologie und Raumfahrt",
    prototypeFundAlt: "Logo des Prototype Fund",
    mastodonAria: "OpenInvoiceXML auf Mastodon",
    linkedinAria: "OpenInvoiceXML auf LinkedIn",
    facebookAria: "OpenInvoiceXML auf Facebook",
    instagramAria: "OpenInvoiceXML auf Instagram",
    threadsAria: "OpenInvoiceXML auf Threads",
  },
  en: {
    privacy: "Privacy",
    impressum: "Impressum",
    project: "Project",
    license: "License",
    github: "GitHub",
    funding: "Funding",
    bmftrAlt: "Logo of the German Federal Ministry of Research, Technology and Space",
    prototypeFundAlt: "Prototype Fund logo",
    mastodonAria: "OpenInvoiceXML on Mastodon",
    linkedinAria: "OpenInvoiceXML on LinkedIn",
    facebookAria: "OpenInvoiceXML on Facebook",
    instagramAria: "OpenInvoiceXML on Instagram",
    threadsAria: "OpenInvoiceXML on Threads",
  },
};
