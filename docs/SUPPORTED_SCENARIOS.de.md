# Unterstützte Szenarien

> Deutsche Übersetzung von [SUPPORTED_SCENARIOS.md](SUPPORTED_SCENARIOS.md). Die Übersetzung wird
> von Hand gepflegt und kann dem englischen Original hinterherhinken; im Zweifel gilt die englische
> Fassung.

Die maßgebliche Übersicht darüber, welche Rechnungsszenarien, Umsatzsteuerfälle und Ausgabeformate
OpenInvoiceXML heute unterstützt. Die Details zu den Gründen stehen in
[`LIMITATIONS.md`](LIMITATIONS.md) (englisch).

Jedes unterstützte Szenario wird durch ein Fixture in [`fixtures/`](../fixtures/README.md) belegt,
das in der Testsuite erzeugt und validiert wird.

Lesehilfe:

- **Unterstützt** – implementiert und durch Fixtures abgedeckt. Eine genannte Einschränkung ist
  geringfügig.
- **Teilweise unterstützt** – funktioniert, aber eine rechtliche Bedingung oder ein Feld wird nicht
  geprüft oder nicht abgebildet. Lesen Sie die Einschränkung, bevor Sie sich darauf verlassen.
- **Ausdrücklich nicht unterstützt** – wird abgelehnt oder liegt außerhalb des Umfangs.

## Ausgabeformate

| Ausgabe                                        | Funktion                                              | Node.js | Browser | Profile                   |
| ---------------------------------------------- | ----------------------------------------------------- | ------- | ------- | ------------------------- |
| XRechnung UBL 2.1 XML                          | `toXRechnung()`                                       | Ja      | Ja      | XRechnung                 |
| XRechnung-UBL-XML mit Validierung              | `generateInvoiceXml()`                                | Ja      | Ja      | XRechnung                 |
| CII-XML                                        | `toCii()`                                             | Ja      | Nein    | `EN16931`, `XRECHNUNG`    |
| Hybrides PDF/A-3 mit XRechnung-UBL             | `toHybridPdf()`                                       | Ja      | Ja      | XRechnung (kein Factur-X) |
| Factur-X/ZUGFeRD-PDF/A-3 mit eingebettetem CII | `toFacturXPdf()`                                      | Ja      | Ja      | `EN16931`, `XRECHNUNG`    |
| Eines der obigen Formate über einen Aufruf     | `generateInvoiceDocument()`                           | Ja      | Nein    | siehe API-Dokumentation   |
| Externe Validierung von XML- oder PDF-Dateien  | `validateXmlExternally()`, `validateFileExternally()` | Ja      | Nein    | – (benötigt Java)         |

Hinweise:

- Der Browser-Einstiegspunkt ist `openinvoicexml/browser`. Er enthält keinen Node-spezifischen
  Code; externe Validatoren benötigen Java und laufen nur unter Node.js.
- Ein mit `toHybridPdf()` erzeugtes hybrides PDF bettet UBL ein und ist daher **kein**
  Factur-X/ZUGFeRD-Dokument. Verwenden Sie dafür `toFacturXPdf()`.
- Signaturen stehen in [`API.md`](API.md) (englisch) bzw. im [Überblick](API.de.md).

## Unterstützt

### Umsatzsteuerkategorien

| Szenario                                                             | Kategorie | Fixtures               |
| -------------------------------------------------------------------- | --------- | ---------------------- |
| Regelsteuersatz 19 %                                                 | `S`       | `01`, `02`, `31`, `32` |
| Ermäßigter Steuersatz 7 %                                            | `S`       | `03`                   |
| Mehrere Steuersätze in einer Rechnung (19 %/7 %)                     | `S`       | `28`                   |
| Gemischte Kategorien in einer Rechnung (19 % + 0 %)                  | `S`, `Z`  | `42`                   |
| Nullsatz                                                             | `Z`       | `05`                   |
| Steuerbefreit (§4 UStG) mit Befreiungsgrund                          | `E`       | `04`                   |
| Kleinunternehmer (§19 UStG)                                          | `E`       | `07`                   |
| Innergemeinschaftliche Lieferung (§6a UStG)                          | `K`       | `08`, `44`, `50`       |
| Ausfuhr in Drittländer (§4 Nr. 1 UStG)                               | `G`       | `09`, `34`, `45`       |
| Nicht steuerbar                                                      | `O`       | `41`                   |
| Steuerschuldnerschaft des Leistungsempfängers (§13b UStG), allgemein | `AE`      | `06`                   |

### Teilfälle der Steuerschuldnerschaft (§13b UStG)

Alle 13 im Validator abgebildeten Teilfälle haben ein Fixture. Kombinationen mit Rabatten und
Zuschlägen: `43`, `46`.

| `reverseChargeReason`     | Gegenstand                               | Fixture |
| ------------------------- | ---------------------------------------- | ------- |
| `construction`            | Bauleistungen                            | `10`    |
| `scrap-and-waste`         | Schrott und Abfallstoffe                 | `11`    |
| `security-transfer`       | Sicherungsübereignung                    | `12`    |
| `cleaning`                | Gebäudereinigung                         | `13`    |
| `mobile-devices`          | Mobilfunkgeräte, Tablets, Spielekonsolen | `14`    |
| `gas-and-electricity`     | Gas und Elektrizität                     | `15`    |
| `eu-cross-border-service` | Grenzüberschreitende EU-Dienstleistung   | `27`    |
| `real-estate`             | Grundstücksumsätze                       | `29`    |
| `telecommunications`      | Telekommunikationsleistungen             | `30`    |
| `foreign-supplier`        | Ausländischer Unternehmer                | `36`    |
| `emission-certificates`   | Emissionszertifikate                     | `37`    |
| `qualifying-gold`         | Anlagegold                               | `38`    |
| `industrial-metals`       | Industriemetalle (Anlage 4)              | `39`    |

Ein passendes Kennzeichen ist notwendig, aber nicht hinreichend, um die Steuerschuldnerschaft zu
belegen; siehe „Teilweise unterstützt“.

### Dokumenttypen und Abrechnungsmuster

| Szenario                                  | Typcode | Fixtures         |
| ----------------------------------------- | ------- | ---------------- |
| Handelsrechnung                           | `380`   | `01`–`15`        |
| Gutschrift, vollständige Stornierung      | `381`   | `16`             |
| Gutschrift, teilweise                     | `381`   | `17`, `47`       |
| Rechnungskorrektur                        | `384`   | `18`, `35`, `50` |
| Anzahlungsrechnung                        | `380`   | `19`, `48`       |
| Schlussrechnung mit Abzug einer Anzahlung | `380`   | `20`             |
| Teilrechnung                              | `380`   | `21`, `49`       |

### Nachlässe, Zuschläge und Beträge

| Szenario                                           | Fixtures   |
| -------------------------------------------------- | ---------- |
| Nachlass auf Dokumentebene (BG-20)                 | `22`       |
| Nachlass auf Positionsebene (BG-27)                | `23`       |
| Nachlass auf Positions- und Dokumentebene zusammen | `24`       |
| Zuschlag auf Dokumentebene (BG-21)                 | `25`       |
| Zuschlag auf Positionsebene (BG-28)                | `26`       |
| Nachlass und Zuschlag auf Dokumentebene zusammen   | `40`       |
| Einzelpreise mit mehr als 2 Nachkommastellen       | `51`, `54` |
| Gebrochene Mengen                                  | `53`, `54` |
| Ausdrücklicher Rundungsbetrag (BT-114)             | `52`       |

### Robustheit und Datenform

| Szenario                                                            | Fixtures   |
| ------------------------------------------------------------------- | ---------- |
| Mehr als 50 Positionen (PDF-Seitenumbruch)                          | `31`       |
| Umlaute und `ß` in Namen, lange umbrochene Beschreibungen           | `32`       |
| Nur Pflichtfelder gesetzt                                           | `33`       |
| Verkäufer ohne USt-IdNr.: Steuernummer (BT-32) als Verkäuferkennung | `55`, `56` |

## Teilweise unterstützt

Diese Szenarien erzeugen gültige Ausgaben, aber die Engine prüft oder bildet nicht jede rechtliche
Bedingung ab. Die Einschränkung gehört zum Vertrag.

| Szenario                               | Was funktioniert                                                                  | Was nicht abgedeckt ist                                                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| §13b-Teilfälle                         | `reverseChargeReason`-Kennzeichen und passender Freitext zum Befreiungsgrund      | Teilfallspezifische Voraussetzungen werden nicht geprüft, etwa die 5.000-€-Grenze bei `mobile-devices` und `industrial-metals`. Ein passendes Stichwort ist kein Nachweis |
| §13b: insolvenzbezogene Übertragungen  | Fällt auf die allgemeinen `AE`-Prüfungen zurück                                   | Kein eigener Teilfall-Bezeichner                                                                                                                                          |
| Kleinunternehmer (§19 UStG)            | Steuernummer des Verkäufers erforderlich, Befreiungstext akzeptiert               | Umsatzgrenzen (25.000 €/100.000 €) und Verzicht nach Abs. 3 werden nicht geprüft                                                                                          |
| Gutschriften (`381`)                   | Negative Beträge, `precedingInvoiceReference` ist Pflicht                         | Gutgeschriebene Beträge werden nicht mit der Ursprungsrechnung abgeglichen                                                                                                |
| Rechnungskorrekturen (`384`)           | Verweis auf die vorangegangene Rechnung ist Pflicht                               | „Nur geänderte Positionen enthalten“ ist eine Konvention und wird nicht erzwungen                                                                                         |
| Anzahlungs- und Schlussrechnung        | Vorausgezahlter Betrag (BT-113) mindert den Zahlbetrag                            | `precedingInvoiceReference` ist ein einzelner Verweis: eine vorangegangene Anzahlung je Schlussrechnung                                                                   |
| Teilrechnung                           | Vertragsreferenz (BT-12), Freitext-`note`                                         | Keine eigenen Felder für Gesamtvertragswert oder Restbetrag; EN 16931 kennt dafür keinen Geschäftsbegriff                                                                 |
| Ausfuhr                                | Kategorie `G` mit Befreiungstext und -code                                        | Kein eigenes Feld für die Zollreferenz. Verwenden Sie `note` (BT-22); siehe Fixture `34`                                                                                  |
| Ort der Leistung                       | Standardregel und B2B-Dienstleistungsausnahme, als nicht blockierende Warnung     | Waren vs. Dienstleistungen, B2C und Sonderfälle (Grundstücke, Beförderung, Veranstaltungen, Bewirtung) werden nicht abgebildet                                            |
| Käuferreferenz (BT-10)                 | Vorhandensein wird für das XRechnung-Profil verlangt                              | Das Format der Leitweg-ID wird nicht geprüft; B2G wird nicht von B2B unterschieden                                                                                        |
| Lieferadresse                          | Ländercode (BT-80) wird erzwungen                                                 | Ort und Postleitzahl (`BR-DE-10`/`BR-DE-11`) werden hier nicht geprüft; KoSIT lehnt fehlende Angaben ab                                                                   |
| Zahlungsmittel und Zahlungsbedingungen | Werden bei Angabe in die Ausgabe geschrieben                                      | `BR-DE-1` (Zahlungsmittel Pflicht) und `BR-CO-25` (Fälligkeitsdatum oder Zahlungsbedingungen bei offenem Betrag) werden hier nicht geprüft; KoSIT erzwingt beide          |
| Validierung der Browser-Ausgabe        | Geschäftsregeln laufen im Browser; CI prüft die getesteten Szenarien              | KoSIT und Mustang benötigen Java und laufen nicht im Browser. Senden Sie das XML an ein Node-Backend und rufen Sie `validateXmlExternally()` auf                          |
| Bestehende Dateien anderer Software    | `validateFileExternally()` führt KoSIT, Mustang und veraPDF aus, soweit anwendbar | Die Geschäftsregeln von OpenInvoiceXML laufen nicht, da hochgeladene Dateien nicht in eine `Invoice` zurückgewandelt werden                                               |

## Ausdrücklich nicht unterstützt

| Punkt                                                                 | Verhalten                                                                                                                                                                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| USt-Codes `L` (Kanarische Inseln, IGIC) und `M` (Ceuta/Melilla, IPSI) | Nicht im Typ der Steuerkategorien; für eine auf Deutschland ausgerichtete Engine außerhalb des Umfangs                                                                                                                      |
| Kategorie `S` mit anderen Sätzen als 19 % und 7 %                     | Wird als `VAT_RATE_INVALID_FOR_CATEGORY` abgelehnt, auch historische Sätze von 16 %/5 %                                                                                                                                     |
| Factur-X/ZUGFeRD-Profile `MINIMUM`, `BASIC WL`, `BASIC`               | Nicht im Typ `EInvoiceProfile` (`"XRECHNUNG"` oder `"EN16931"`). `MINIMUM` und `BASIC WL` enthalten keine Rechnungspositionen und sind in Deutschland keine gültigen E-Rechnungen; `BASIC` ist eine Teilmenge von `EN16931` |
| Rechnungsdatei in das `Invoice`-Modell importieren                    | Dateien können nur extern validiert, nicht in das Modell zurückgelesen werden                                                                                                                                               |
| KoSIT, Mustang oder veraPDF im Browser ausführen                      | Benötigt Java; nur Node.js                                                                                                                                                                                                  |
| Auswahl zwischen mehreren Rechnungs-XML in einer PDF                  | `validateFileExternally()` meldet das Problem und rät nicht                                                                                                                                                                 |

## Aktuell halten

Wird ein Szenario ergänzt, ändern Sie seine Zeile hier in derselben Änderung. Ergänzen Sie zuerst
ein Fixture und eine Zeile in [`fixtures/README.md`](../fixtures/README.md); diese Datei fasst nur
zusammen, was diese Fixtures und die Validatoren belegen.
