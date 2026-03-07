import type { OleObjectType } from "../types";

/**
 * Map of well-known OLE progIds to application types and file extensions.
 */
const PROG_ID_MAP: ReadonlyArray<{
  pattern: RegExp;
  type: OleObjectType;
  extension: string;
}> = [
  { pattern: /^Excel\./i, type: "excel", extension: "xlsx" },
  { pattern: /^Word\./i, type: "word", extension: "docx" },
  { pattern: /^PowerPoint\./i, type: "excel", extension: "pptx" },
  { pattern: /^Visio\./i, type: "visio", extension: "vsdx" },
  { pattern: /^Equation\./i, type: "mathtype", extension: "wmf" },
  { pattern: /^MathType/i, type: "mathtype", extension: "wmf" },
  { pattern: /^AcroExch\./i, type: "pdf", extension: "pdf" },
  { pattern: /^Acrobat\./i, type: "pdf", extension: "pdf" },
  { pattern: /^Package$/i, type: "package", extension: "bin" },
];

/**
 * Map of well-known CLSIDs (uppercase, braces stripped) to application types.
 */
const CLSID_MAP: ReadonlyMap<
  string,
  { type: OleObjectType; extension: string }
> = new Map([
  // Excel Workbook
  ["00020820-0000-0000-C000-000000000046", { type: "excel", extension: "xls" }],
  [
    "00020830-0000-0000-C000-000000000046",
    { type: "excel", extension: "xlsx" },
  ],
  // Word Document
  ["00020906-0000-0000-C000-000000000046", { type: "word", extension: "doc" }],
  ["F4754C9B-64F5-4B40-8AF4-679732AC0607", { type: "word", extension: "docx" }],
  // Package (generic embedded file)
  [
    "0003000C-0000-0000-C000-000000000046",
    { type: "package", extension: "bin" },
  ],
  // Adobe Acrobat
  ["B801CA65-A1FC-11D0-85AD-444553540000", { type: "pdf", extension: "pdf" }],
  // Visio
  ["00021A20-0000-0000-C000-000000000046", { type: "visio", extension: "vsd" }],
  // Equation Editor
  [
    "0002CE02-0000-0000-C000-000000000046",
    { type: "mathtype", extension: "wmf" },
  ],
]);

/**
 * Detect OLE object type and file extension from progId and/or clsId.
 */
export function detectOleObjectType(
  progId: string | undefined,
  clsId: string | undefined,
): { oleObjectType: OleObjectType; oleFileExtension: string } {
  if (progId) {
    for (const entry of PROG_ID_MAP) {
      if (entry.pattern.test(progId)) {
        return { oleObjectType: entry.type, oleFileExtension: entry.extension };
      }
    }
  }

  if (clsId) {
    const normalised = clsId.replace(/[{}]/g, "").toUpperCase().trim();
    const match = CLSID_MAP.get(normalised);
    if (match) {
      return { oleObjectType: match.type, oleFileExtension: match.extension };
    }
  }

  // Try to infer from the oleTarget path extension
  return { oleObjectType: "unknown", oleFileExtension: "bin" };
}

/**
 * Infer file extension from an OLE target path inside the PPTX zip.
 * Returns undefined if no extension can be determined.
 */
export function inferOleExtensionFromTarget(
  oleTarget: string | undefined,
): string | undefined {
  if (!oleTarget) return undefined;
  const lastDot = oleTarget.lastIndexOf(".");
  if (lastDot === -1) return undefined;
  const ext = oleTarget.slice(lastDot + 1).toLowerCase();
  if (ext.length > 0 && ext.length <= 10) return ext;
  return undefined;
}

/**
 * Return a human-readable label for an OLE object type.
 */
export function getOleObjectTypeLabel(
  oleObjectType: OleObjectType | undefined,
): string {
  switch (oleObjectType) {
    case "excel":
      return "Microsoft Excel";
    case "word":
      return "Microsoft Word";
    case "pdf":
      return "PDF Document";
    case "visio":
      return "Microsoft Visio";
    case "mathtype":
      return "Equation";
    case "package":
      return "Embedded File";
    default:
      return "Embedded Object";
  }
}
