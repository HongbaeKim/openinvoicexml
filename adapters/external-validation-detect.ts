// This file is basically a traffic controller for uploaded invoice files.
//
// Detects the uploaded file type from its content, not its file name or extension.
// Used to decide which validators should run.
//
// uploaded bytes
//      ↓
// Is it XML?
//      ├─ yes → UBL XML
//      │        CII XML
//      │        other XML
//      │        broken XML
//      │
//      └─ no → Is it PDF?
//                ├─ yes → PDF
//                └─ no  → UNKNOWN

export type InvoiceFileFormat =
  "UBL_XML" | "CII_XML" | "XML_OTHER" | "XML_MALFORMED" | "PDF" | "UNKNOWN";

const UBL_ROOTS: ReadonlyMap<string, string> = new Map([
  ["urn:oasis:names:specification:ubl:schema:xsd:Invoice-2", "Invoice"],
  ["urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2", "CreditNote"],
]);
const CII_NAMESPACE = "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100";
// Only look inside the first 1024 bytes when searching for the PDF marker.
const PDF_HEADER_WINDOW = 1024;

/** Decodes bytes as text for detection, honoring a UTF-8 or UTF-16 BOM. Never throws. */
//         UTF-16LE     UTF-16BE
//
// "A"     41 00        00 41
// "B"     42 00        00 42
// "C"     43 00        00 43
function decodeForDetection(bytes: Uint8Array): string {
  let encoding = "utf-8";
  // UTF-16LE
  if (bytes[0] === 0xff && bytes[1] === 0xfe) 
    encoding = "utf-16le";
  // UTF-16BE
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) 
    encoding = "utf-16be";
  // TextDecoder strips the BOM itself; invalid sequences become U+FFFD instead of throwing.
  return new TextDecoder(encoding).decode(bytes);
}

function hasPdfHeader(bytes: Uint8Array): boolean {
  // The PDF header is ASCII, so we can decode it as Latin-1 (ISO-8859-1) to avoid any UTF-8
  // Decode the beginning as text so we can check for the PDF header "%PDF-".
  const window = new TextDecoder("latin1").decode(
    // Take only the first PDF_HEADER_WINDOW bytes
    bytes.subarray(0, PDF_HEADER_WINDOW)
  );
  
  return window.includes("%PDF-");
}

/** Index just past the XML prolog (declaration, comments, PIs, DOCTYPE), or -1 if unreadable. */
function skipProlog(text: string): number {
  let i = 0;
  // Keep looping until we reach return
  for (;;) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    // <?xml version="1.0"?> ← XML declaration
    // <?something here?> ← processing instruction
    if (text.startsWith("<?", i)) {
      const end = text.indexOf("?>", i + 2);
      if (end === -1) 
        return -1;
      i = end + 2;
    } 
      // <!-- hello --> ← comment
      else if (text.startsWith("<!--", i)) {
      const end = text.indexOf("-->", i + 4);
      if (end === -1) 
        return -1;
      i = end + 3;
    } 
      // <!DOCTYPE ... > ← DOCTYPE declaration
      else if (text.startsWith("<!DOCTYPE", i)) {
      // Skipped, never resolved. KoSIT and Mustang reject any DOCTYPE themselves.
      const bracket = text.indexOf("[", i);
      const close = text.indexOf(">", i);
      if (close === -1) 
        return -1;
      if (bracket !== -1 && bracket < close) {
        const subsetEnd = text.indexOf("]", bracket);
        const end = subsetEnd === -1 ? -1 : text.indexOf(">", subsetEnd);
        if (end === -1) 
          return -1;
        i = end + 1;
      } else {
        i = close + 1;
      }
    } 
    // if we have reached: <Invoice>
    // This must be where the actual XML starts.
    else {
      return i;
    }
  }
}

// Find the first XML tag and its attributes.
const ROOT_START_TAG =
  /^<([A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/;

// Find the xmlns namespace declarations inside those attributes.
const XMLNS_ATTR = /\s+xmlns(?::([\w.-]+))?\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/**
 * Detect what kind of XML this is from its root element.
 *
 * This only checks the beginning and end of the root element.
 * KoSIT and Mustang do the full XML validation later.
 */
function classifyXml(text: string): InvoiceFileFormat {
  const rootStart = skipProlog(text);
  // If the XML beginning is broken, return XML_MALFORMED
  if (rootStart === -1) 
    return "XML_MALFORMED";

  const rootTag = ROOT_START_TAG.exec(text.slice(rootStart));
  if (!rootTag) 
    return "XML_MALFORMED";

  //
  // example
  // <ubl:Invoice xmlns:ubl="urn:example">
  // rootName = "ubl:Invoice", attributes = ' xmlns:ubl="urn:example"', isSelfClosing = ""
  const rootName = rootTag[1]!;
  const attributes = rootTag[2] ?? "";
  const isSelfClosing = rootTag[3] === "/";

  // Make sure a normal root element also has a closing tag.
  if (!isSelfClosing) {
    const escapedRootName = rootName.replace(/[.]/g, "\\.");
    const closingTag = new RegExp(
      `</${escapedRootName}\\s*>(?:\\s|<!--[\\s\\S]*?-->|<\\?[\\s\\S]*?\\?>)*$`,
    );

    if (!closingTag.test(text)) return "XML_MALFORMED";
  }

  // Collect namespace declarations such as:
  // xmlns="..." and xmlns:ubl="..."
  const namespaces = new Map<string, string>();

  for (const attribute of attributes.matchAll(XMLNS_ATTR)) {
    const prefix = attribute[1] ?? "";
    const value = attribute[2] ?? attribute[3] ?? "";
    namespaces.set(prefix, value);
  }

  // Split "ubl:Invoice" into "ubl" and "Invoice".
  const colonIndex = rootName.indexOf(":");
  const prefix = colonIndex === -1 ? "" : rootName.slice(0, colonIndex);
  const localName =
    colonIndex === -1 ? rootName : rootName.slice(colonIndex + 1);

  const namespace = namespaces.get(prefix);

  if (
    namespace !== undefined &&
    UBL_ROOTS.get(namespace) === localName
  ) {
    return "UBL_XML";
  }

  if (
    namespace === CII_NAMESPACE &&
    localName === "CrossIndustryInvoice"
  ) {
    return "CII_XML";
  }

  return "XML_OTHER";
}

/**
 * Detect the uploaded file type from its content.
 *
 * The file name, extension and MIME type are not trusted.
 */
export function detectInvoiceFormat(
  bytes: Uint8Array,
): InvoiceFileFormat {
  const text = decodeForDetection(bytes);

  if (text.trimStart().startsWith("<")) {
    return classifyXml(text);
  }

  if (hasPdfHeader(bytes)) {
    return "PDF";
  }

  return "UNKNOWN";
}