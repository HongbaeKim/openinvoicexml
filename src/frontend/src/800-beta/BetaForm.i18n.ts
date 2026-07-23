import type { Lang } from "../000-core/i18n";

export const betaFormDict: Record<
  Lang,
  {
    nameLabel: string;
    emailLabel: string;
    roleLabel: string;
    roleOptions: { value: string; label: string }[];
    roleOtherLabel: string;
    roleOtherPlaceholder: string;
    messageLabel: string;
    wantsContactLabel: string;
    optionalLabel: string;
    consent: { before: string; linkText: string; after: string };
    consentRequiredError: string;
    mandatoryLegend: string;
    submit: string;
    alreadySignedUp: string;
    success: string;
    genericError: string;
    networkError: string;
  }
> = {
  de: {
    nameLabel: "Name oder Unternehmensname",
    emailLabel: "E-Mail",
    roleLabel: "Was trifft am besten auf dich zu?",
    roleOptions: [
      { value: "freelancer", label: "Freiberufler:in" },
      { value: "small_business", label: "Kleines Unternehmen" },
      { value: "ngo", label: "NGO" },
      { value: "accountant", label: "Steuerberater:in" },
      { value: "other", label: "Sonstiges" },
    ],
    roleOtherLabel: "Bitte gib an, was am besten auf dich zutrifft",
    roleOtherPlaceholder: "z. B. Gemeinnütziger Verein",
    messageLabel: "Möchtest du uns noch etwas mitteilen?",
    wantsContactLabel: "Benachrichtige mich, sobald die Beta verfügbar ist.",
    optionalLabel: "optional",
    consent: {
      before:
        "Ich bin damit einverstanden, über openinvoicexml-Updates kontaktiert zu werden. Siehe den ",
      linkText: "Datenschutzhinweis",
      after: ".",
    },
    consentRequiredError: "Bitte stimme zu, kontaktiert zu werden, um fortzufahren.",
    mandatoryLegend: "* Pflichtfeld",
    submit: "Am Beta-Programm teilnehmen",
    alreadySignedUp: "Du bist bereits auf der Liste — danke!",
    success: "Du bist dabei. Danke, dass du am Beta-Programm teilnimmst!",
    genericError: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    networkError: "Server konnte nicht erreicht werden. Bitte versuche es gleich noch einmal.",
  },
  en: {
    nameLabel: "Name or Company Name",
    emailLabel: "Email",
    roleLabel: "What best describes you?",
    roleOptions: [
      { value: "freelancer", label: "Freelancer" },
      { value: "small_business", label: "Small business" },
      { value: "ngo", label: "NGO" },
      { value: "accountant", label: "Accountant" },
      { value: "other", label: "Other" },
    ],
    roleOtherLabel: "Please specify what best describes you",
    roleOtherPlaceholder: "e.g. Nonprofit organization",
    messageLabel: "Is there anything else you'd like to tell us?",
    wantsContactLabel: "Notify me when the beta becomes available.",
    optionalLabel: "optional",
    consent: {
      before: "I agree to be contacted about openinvoicexml updates. See the ",
      linkText: "privacy notice",
      after: ".",
    },
    consentRequiredError: "Please agree to be contacted to continue.",
    mandatoryLegend: "* Mandatory field",
    submit: "Join the Beta Program",
    alreadySignedUp: "You're already on the list — thanks!",
    success: "You're in. Thanks for joining the beta program!",
    genericError: "Something went wrong. Please try again.",
    networkError: "Couldn't reach the server. Please try again in a moment.",
  },
};
