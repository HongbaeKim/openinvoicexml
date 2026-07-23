import type { Lang } from "../000-core/i18n";

export const betaPageDict: Record<
  Lang,
  {
    metaTitle: string;
    metaDescription: string;
    heading: string;
    intro: string;
    howItWorksHeading: string;
    howItWorksBody: string;
    benefits: { title: string; description: string }[];
  }
> = {
  de: {
    metaTitle: "Am Beta-Programm teilnehmen — openinvoicexml",
    metaDescription:
      "Nimm am openinvoicexml Beta-Programm teil für frühen Zugang zu einem gehosteten E-Rechnungs-Tool für Freiberufler und kleine Unternehmen. Kostenlos — trage dich auf die Warteliste ein.",
    heading: "Am Beta-Programm teilnehmen",
    intro:
      "Für Freiberufler, kleine Unternehmen und NGOs, die einfach konforme E-Rechnungen ausstellen möchten. Trage dich auf die Warteliste ein, um zu den Ersten zu gehören, die eingeladen werden, sobald die Beta verfügbar ist. Die Teilnahme ist kostenlos.",
    howItWorksHeading: "So funktioniert's",
    howItWorksBody:
      "Erstelle deine E-Rechnung direkt im Browser und lade sie als XML-Datei herunter. Du kannst sie jederzeit selbst wieder öffnen und bearbeiten — ganz ohne Account oder Login.",
    benefits: [
      {
        title: "Kostenloser früher Zugang",
        description: "Nutze OpenInvoiceXML schon vor dem offiziellen Start, völlig kostenlos.",
      },
      {
        title: "Persönliches Onboarding",
        description:
          "Erhalte persönliche Unterstützung bei der Einrichtung — du bist nicht auf dich allein gestellt.",
      },
      {
        title: "Hilfe bei der Vorbereitung auf Deutschlands B2B-E-Rechnungspflicht ab 2028",
        description:
          "Bereite dich frühzeitig auf die verpflichtenden B2B-E-Rechnungsregeln ab 2028 vor.",
      },
      {
        title: "Direkter Kontakt zum Entwickler",
        description:
          "Wende dich direkt mit Fragen oder Feedback — ganz ohne Support-Ticket-Warteschlange.",
      },
      // {
      //   title: "Einfluss auf zukünftige Funktionen",
      //   description: "Dein Feedback bestimmt mit, was als Nächstes gebaut wird.",
      // },
    ],
  },
  en: {
    metaTitle: "Join the Beta Program — openinvoicexml",
    metaDescription:
      "Join the openinvoicexml beta program for early access to a hosted e-invoicing tool for freelancers and small businesses. Free to participate — join the waitlist for early access.",
    heading: "Join the Beta Program",
    intro:
      "For freelancers, small businesses, and NGOs who want an easy way to issue compliant e-invoices. Join the waitlist to be among the first invited when the beta becomes available. Participation will be free.",
    howItWorksHeading: "How it works",
    howItWorksBody:
      "Create your e-invoice right in the browser and download it as an XML file. Open and update it yourself anytime — no account or login required.",
    benefits: [
      {
        title: "Free early access",
        description: "Use OpenInvoiceXML before the public launch, at no cost.",
      },
      {
        title: "Personal onboarding",
        description: "Get hands-on help getting set up — you won't be figuring it out alone.",
      },
      {
        title: "Help preparing for Germany's 2028 B2B e-invoicing requirement",
        description: "Get ahead of the mandatory B2B e-invoicing rules coming in 2028.",
      },
      {
        title: "Direct contact with the developer",
        description: "Reach out directly with questions or feedback — no support ticket queue.",
      },
      // {
      //   title: "Influence on future features",
      //   description: "Your feedback shapes what gets built next.",
      // },
    ],
  },
};
