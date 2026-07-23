import type { Lang } from "../000-core/i18n";

export const developerFormDict: Record<
  Lang,
  {
    nameLabel: string;
    emailLabel: string;
    roleLabel: string;
    roleOptions: { value: string; label: string }[];
    roleOtherLabel: string;
    roleOtherPlaceholder: string;
    whatToBuildLabel: string;
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
    roleLabel: "Rolle",
    roleOptions: [
      { value: "software_developer", label: "Softwareentwickler:in" },
      { value: "erp_developer", label: "ERP-Entwickler:in" },
      { value: "accounting_software", label: "Buchhaltungssoftware" },
      { value: "system_integrator", label: "Systemintegrator:in" },
      { value: "other", label: "Sonstiges" },
    ],
    roleOtherLabel: "Bitte gib deine Rolle an",
    roleOtherPlaceholder: "z. B. Produktmanager:in",
    whatToBuildLabel: "Was möchtest du mit OpenInvoiceXML bauen?",
    wantsContactLabel: "Kontaktiere mich, sobald diese Funktionen verfügbar sind.",
    optionalLabel: "optional",
    consent: {
      before:
        "Ich bin damit einverstanden, über openinvoicexml-Updates kontaktiert zu werden. Siehe den ",
      linkText: "Datenschutzhinweis",
      after: ".",
    },
    consentRequiredError: "Bitte stimme zu, kontaktiert zu werden, um fortzufahren.",
    mandatoryLegend: "* Pflichtfeld",
    submit: "Teile deine Integrationsanforderungen",
    alreadySignedUp: "Du bist bereits auf der Liste — danke!",
    success: "Danke — dein Feedback hilft uns, das Richtige zu bauen.",
    genericError: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
    networkError: "Server konnte nicht erreicht werden. Bitte versuche es gleich noch einmal.",
  },
  en: {
    nameLabel: "Name or Company Name",
    emailLabel: "Email",
    roleLabel: "Role",
    roleOptions: [
      { value: "software_developer", label: "Software Developer" },
      { value: "erp_developer", label: "ERP Developer" },
      { value: "accounting_software", label: "Accounting Software" },
      { value: "system_integrator", label: "System Integrator" },
      { value: "other", label: "Other" },
    ],
    roleOtherLabel: "Please specify your role",
    roleOtherPlaceholder: "e.g. Product Manager",
    whatToBuildLabel: "What would you like to build with OpenInvoiceXML?",
    wantsContactLabel: "Contact me when these features are available.",
    optionalLabel: "optional",
    consent: {
      before: "I agree to be contacted about openinvoicexml updates. See the ",
      linkText: "privacy notice",
      after: ".",
    },
    consentRequiredError: "Please agree to be contacted to continue.",
    mandatoryLegend: "* Mandatory field",
    submit: "Share your integration needs",
    alreadySignedUp: "You're already on the list — thanks!",
    success: "Thanks — your feedback will help shape what we build next.",
    genericError: "Something went wrong. Please try again.",
    networkError: "Couldn't reach the server. Please try again in a moment.",
  },
};
