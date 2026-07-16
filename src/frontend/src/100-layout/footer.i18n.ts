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
  },
};
