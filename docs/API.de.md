# API-Überblick

> Gekürzte deutsche Übersicht über [API.md](API.md). Sie ist keine vollständige Übersetzung: Die
> englische Fassung enthält Parameter, Rückgabetypen, Fehlercodes und Beispiele für jede Funktion
> und ist maßgeblich. Die Übersetzung wird von Hand gepflegt und kann hinterherhinken.

Die Rechnungsdaten (`Invoice`) sind in [`DATA-MODEL.md`](DATA-MODEL.md) beschrieben (englisch).

## Einstiegspunkte

| Import                      | Umgebung | Inhalt                                                                                             |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `openinvoicexml/browser`    | Browser  | `generateInvoiceXml`, `toXRechnung`, `toHybridPdf`, `toFacturXPdf`, `validateBusinessRules`, Typen |
| `openinvoicexml/adapters`   | Node.js  | Alle Erzeugungsfunktionen, `extractEmbeddedXml`, externe Validierung von XML und Dateien           |
| `openinvoicexml/validators` | Node.js  | `validateInvoiceSchema`, `validateBusinessRules`, `runKosit`/`runVeraPdf`/`runMustang`, Konverter  |
| `openinvoicexml`            | beliebig | Die `Invoice`-Typen                                                                                |

Alles, was Java (KoSIT, Mustang, veraPDF) oder das Dateisystem benötigt, läuft nur unter Node.js.
`toHybridPdf` und `toFacturXPdf` gibt es in `openinvoicexml/browser` und `openinvoicexml/adapters`
mit gleicher Ausgabe; sie unterscheiden sich nur im Laden der Schriftarten.

## Funktionen

| Funktion                                       | Browser | Node.js | Aufruf | Zweck                                                                                                            |
| ---------------------------------------------- | ------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| `generateInvoiceDocument(invoice, { format })` | Nein    | Ja      | async  | Ein Aufrufpunkt für XRechnung UBL/CII und Factur-X (EN16931/XRechnung)                                           |
| `generateInvoice(invoice, options)`            | Nein    | Ja      | sync   | Schema- und Geschäftsregelprüfung, dann XRechnung-UBL-XML; optional `validateExternally` (KoSIT)                 |
| `generateInvoiceXml(invoice)`                  | Ja      | Ja      | sync   | Geschäftsregelprüfung, dann XRechnung-UBL-XML; ohne Schema-Prüfung, daher auch im Browser                        |
| `toXRechnung(invoice)`                         | Ja      | Ja      | sync   | Nur Umwandlung in UBL-XML, **ohne** Validierung                                                                  |
| `generateCii(invoice, { profile })` / `toCii`  | Ja      | Ja      | sync   | CII-XML mit bzw. ohne Prüfung; Profil `EN16931` (Standard) oder `XRECHNUNG`. Im Browser ohne JSON-Schema-Prüfung |
| `generateHybridPdf` / `toHybridPdf`            | Nein/Ja | Ja      | async  | Hybrides PDF/A-3 mit eingebettetem UBL (kein Factur-X/ZUGFeRD-Anspruch)                                          |
| `generateFacturXPdf` / `toFacturXPdf`          | Nein/Ja | Ja      | async  | Echtes Factur-X/ZUGFeRD-PDF mit eingebettetem CII                                                                |
| `extractEmbeddedXml(pdfPath, name)`            | Nein    | Ja      | async  | Liest das eingebettete XML aus einer von dieser Bibliothek erzeugten PDF                                         |
| `validateBusinessRules(invoice, profile)`      | Ja      | Ja      | sync   | Geschäftsregeln; gibt `ValidationIssue[]` zurück, wirft nie                                                      |
| `validateInvoiceSchema(data)`                  | Nein    | Ja      | sync   | Strukturprüfung gegen das JSON-Schema                                                                            |
| `validateXmlExternally(xml, options)`          | Nein    | Ja      | sync   | Prüft vorhandenes XML mit KoSIT und Mustang (benötigt Java)                                                      |
| `validateFileExternally(bytes, options)`       | Nein    | Ja      | async  | Prüft eine vorhandene XML- oder PDF-Datei mit KoSIT, Mustang und veraPDF                                         |
| `detectInvoiceFormat(bytes)`                   | Nein    | Ja      | sync   | Erkennt das Dateiformat am Inhalt, nicht am Dateinamen                                                           |

Die Spalte „Browser“ bei den PDF-Funktionen: `generate*` nur unter Node.js, `to*` in beiden
Umgebungen.

## Ergebnisse und Fehler

- Die `generate*`-Funktionen werfen bei ungültigen Rechnungen nicht, sondern geben `null` für das
  Dokument zurück und listen die Probleme in `issues` (`ValidationIssue[]`). Die Ausgabe ist
  `null`, genau dann wenn mindestens ein Eintrag `severity: "error"` hat. Warnungen blockieren
  nichts.
- Jede `ValidationIssue` hat einen stabilen, maschinenlesbaren `code` (zum Verzweigen geeignet),
  eine `message` für Menschen, einen `path` und eine `severity` (`"error"` oder `"warning"`).
  Strukturfehler tragen Codes mit dem Präfix `SCHEMA_`.
- Die `to*`-Funktionen validieren **nicht** und setzen eine bereits geprüfte `Invoice` voraus.
- `validateFileExternally()` liefert den Status `PASS`, `FAIL`, `UNAVAILABLE` (ein benötigter
  Validator konnte nicht laufen, etwa wegen fehlendem Java) oder `UNSUPPORTED`. Ein `PASS` bedeutet,
  dass das **Dateiformat** die zutreffenden Prüfungen bestanden hat; es bestätigt nicht, dass
  Beträge, Umsatzsteuerbehandlung oder Parteien inhaltlich richtig sind.

## Browser und Node.js

Browseranwendungen (React, Vue, Erweiterungen) nutzen `openinvoicexml/browser`, um Geschäftsregeln
zu prüfen und XML oder PDFs lokal zu erzeugen. Die Schriftart (DejaVu Sans, etwa 1,4 MB) wird beim
ersten PDF-Aufruf geladen oder über die Option `fonts` übergeben. Externe Validatoren laufen im
Browser nicht; senden Sie das erzeugte XML an ein Node-Backend und rufen Sie dort
`validateXmlExternally()` auf.

Beispiel (Node.js):

```ts
import { generateInvoiceDocument } from "openinvoicexml/adapters";

const result = await generateInvoiceDocument(invoice, { format: "FACTURX_XRECHNUNG" });

if (result.content === null) {
  for (const issue of result.issues) console.error(`${issue.code}: ${issue.message}`);
} else if (result.contentType === "pdf") {
  // result.content ist ein Uint8Array
}
```

## Weiterführend

- Vollständige Referenz: [`API.md`](API.md) (englisch)
- Unterstützte Szenarien: [`SUPPORTED_SCENARIOS.de.md`](SUPPORTED_SCENARIOS.de.md)
- Einschränkungen: [`LIMITATIONS.md`](LIMITATIONS.md) (englisch)
