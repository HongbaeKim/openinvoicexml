import type { Lang } from "../000-core/i18n";

export const developerPageDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    intro: string;
  }
> = {
  de: {
    metaTitle: "Gestalte OpenInvoiceXML mit — openinvoicexml",
    metaDescription:
      "Sag openinvoicexml, was du zur Integration in deine Software brauchst — dein Feedback bestimmt, was als Nächstes gebaut wird.",
    heading: "Gestalte OpenInvoiceXML mit",
    intro:
      "Sag uns, was du brauchst, um OpenInvoiceXML in deine Software zu integrieren — dein Feedback bestimmt, was wir als Nächstes bauen.",
  },
  en: {
    metaTitle: "Help Shape OpenInvoiceXML — openinvoicexml",
    metaDescription:
      "Tell openinvoicexml what you need to integrate it into your software — your feedback guides what we build next.",
    heading: "Help Shape OpenInvoiceXML",
    intro:
      "Tell us what you need to integrate OpenInvoiceXML into your software — your feedback guides what we build next.",
  },
};
