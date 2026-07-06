/** BG-4 / BG-7: Seller or buyer party. */
export interface Party {
  /** BT-27 / BT-44: Trading name. */
  name: string;
  /** BT-30 / BT-47: Legal registration identifier (e.g. Handelsregisternummer). */
  legalId?: string;

  /** BT-31 / BT-48: VAT registration number (Umsatzsteuer-Identifikationsnummer). */
  vatId?: string;
  /** BT-32: Seller tax registration number (Steuernummer, for §19 small businesses). */
  taxRegistrationId?: string;

  /** BG-5 / BG-8: Postal address. */
  address: {
    /** BT-35 / BT-50: Address line 1. */
    line1: string;
    /** BT-36 / BT-51: Address line 2. */
    line2?: string;
    /** BT-37 / BT-52: City. */
    city: string;
    /** BT-38 / BT-53: Postal code. */
    postalCode: string;
    /** BT-40 / BT-55: Country code (ISO 3166-1 alpha-2). */
    countryCode: string;
  };

  /** BT-34 / BT-49: Electronic address (e.g. email) for routing. */
  electronicAddress: string;
  /** BT-34 / BT-49: Scheme identifier for the electronic address (e.g. "EM" for email). */
  electronicAddressSchemeId?: string;

  /** BG-6: Contact. Required on the seller for XRechnung (BR-DE-2). */
  contact?: {
    /** BT-41: Contact point (person or department name). */
    name?: string;
    /** BT-42: Contact telephone number. */
    telephone: string;
    /** BT-43: Contact email address. */
    email: string;
  };
}
