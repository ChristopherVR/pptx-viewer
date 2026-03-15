/**
 * PPTX file validation and repair utilities.
 *
 * Validates the structural integrity of a PPTX (OOXML) package
 * without fully loading it into the runtime. Optionally repairs
 * common issues such as missing content types, dangling relationship
 * references, and malformed XML.
 *
 * @module utils/pptx-validator
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  /** Internal ZIP path the issue relates to, if applicable. */
  path?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface RepairResult {
  repaired: ArrayBuffer;
  repairs: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Files that must exist in every valid PPTX package. */
const REQUIRED_PATHS = [
  "[Content_Types].xml",
  "_rels/.rels",
  "ppt/presentation.xml",
] as const;

/** Well-known content type mappings by file extension. */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  rels: "application/vnd.openxmlformats-package.relationships+xml",
  xml: "application/xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  emf: "image/x-emf",
  wmf: "image/x-wmf",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  bin: "application/vnd.ms-office.vbaProject",
};

/** Part-name to content type for common PPTX override parts. */
const PART_CONTENT_TYPES: Record<string, string> = {
  "/ppt/presentation.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml",
  "/ppt/presProps.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml",
  "/ppt/viewProps.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml",
  "/ppt/tableStyles.xml":
    "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml",
  "/docProps/core.xml":
    "application/vnd.openxmlformats-package.core-properties+xml",
  "/docProps/app.xml":
    "application/vnd.ms-officedocument.extended-properties+xml",
};

const SLIDE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";
const SLIDE_LAYOUT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml";
const SLIDE_MASTER_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml";
const THEME_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.theme+xml";

// ---------------------------------------------------------------------------
// XML parser (shared, safe defaults)
// ---------------------------------------------------------------------------

function createParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
    removeNSPrefix: false,
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
}

function normalisePath(p: string): string {
  return p.startsWith("/") ? p : `/${p}`;
}

/**
 * Attempt to open a buffer as a ZIP.
 * Returns the JSZip instance or null if the buffer is not a valid ZIP.
 */
async function tryOpenZip(
  buffer: ArrayBuffer,
): Promise<{ zip: JSZip } | { error: string }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    return { zip };
  } catch {
    return { error: "Buffer is not a valid ZIP file" };
  }
}

/**
 * Try to parse an XML string.
 * Returns the parsed object or an error message.
 */
function tryParseXml(
  xml: string,
  parser: XMLParser,
): { data: Record<string, unknown> } | { error: string } {
  try {
    const data = parser.parse(xml) as Record<string, unknown>;
    return { data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: msg };
  }
}

/**
 * Read a text file from the ZIP, returning null if it doesn't exist.
 */
async function readZipText(
  zip: JSZip,
  path: string,
): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  return entry.async("string");
}

/**
 * Extract relationship entries from a parsed .rels XML object.
 */
function extractRelationships(
  parsed: Record<string, unknown>,
): Array<{ id: string; type: string; target: string }> {
  const relsRoot = parsed["Relationships"] as Record<string, unknown> | undefined;
  if (!relsRoot) return [];
  const entries = ensureArray(
    relsRoot["Relationship"] as Record<string, unknown> | Record<string, unknown>[],
  );
  return entries
    .filter((e) => e != null)
    .map((e) => ({
      id: String(e["@_Id"] ?? ""),
      type: String(e["@_Type"] ?? ""),
      target: String(e["@_Target"] ?? ""),
    }));
}

/**
 * Resolve a relationship target path relative to the directory that
 * owns the .rels file.
 */
function resolveRelTarget(relsDir: string, target: string): string {
  // Absolute targets (start with /) are returned as-is (strip leading /)
  if (target.startsWith("/")) return target.substring(1);
  // External targets (urls) are returned as-is
  if (/^https?:\/\//i.test(target)) return target;

  const parts = relsDir.split("/").filter(Boolean);
  for (const segment of target.split("/")) {
    if (segment === "..") {
      parts.pop();
    } else if (segment !== ".") {
      parts.push(segment);
    }
  }
  return parts.join("/");
}

/**
 * Get the directory that owns a .rels file.
 * e.g. "ppt/_rels/presentation.xml.rels" -> "ppt"
 *      "_rels/.rels" -> ""
 */
function relsOwnerDir(relsPath: string): string {
  // Remove the _rels/ segment and the .rels file itself
  const dir = relsPath.replace(/_rels\/[^/]+$/, "");
  return dir.endsWith("/") ? dir.slice(0, -1) : dir;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

async function validateZipStructure(
  zip: JSZip,
  issues: ValidationIssue[],
): Promise<void> {
  // Check required files exist
  for (const required of REQUIRED_PATHS) {
    if (!zip.file(required)) {
      issues.push({
        severity: "error",
        code: "MISSING_REQUIRED_FILE",
        message: `Required file "${required}" is missing from the package`,
        path: required,
      });
    }
  }
}

async function validateContentTypes(
  zip: JSZip,
  parser: XMLParser,
  issues: ValidationIssue[],
): Promise<void> {
  const ctXml = await readZipText(zip, "[Content_Types].xml");
  if (!ctXml) return; // Already flagged as missing required file

  const result = tryParseXml(ctXml, parser);
  if ("error" in result) {
    issues.push({
      severity: "error",
      code: "MALFORMED_CONTENT_TYPES",
      message: `[Content_Types].xml is malformed: ${result.error}`,
      path: "[Content_Types].xml",
    });
    return;
  }

  const typesRoot = result.data["Types"] as Record<string, unknown> | undefined;
  if (!typesRoot) {
    issues.push({
      severity: "error",
      code: "INVALID_CONTENT_TYPES",
      message: "[Content_Types].xml is missing <Types> root element",
      path: "[Content_Types].xml",
    });
    return;
  }

  // Collect overridden part names
  const overrides = ensureArray(
    typesRoot["Override"] as Record<string, unknown> | Record<string, unknown>[],
  );
  const overridePartNames = new Set<string>();
  for (const entry of overrides) {
    const partName = entry?.["@_PartName"];
    if (typeof partName === "string") {
      // Part names in content types have leading slash; ZIP paths don't
      const zipPath = partName.startsWith("/") ? partName.substring(1) : partName;
      overridePartNames.add(zipPath);
      // Check that the part actually exists in the archive
      if (!zip.file(zipPath)) {
        issues.push({
          severity: "warning",
          code: "CONTENT_TYPE_MISSING_PART",
          message: `Content type override references "${partName}" which does not exist in the archive`,
          path: "[Content_Types].xml",
        });
      }
    }
  }

  // Check that XML files in ppt/ that are not in overrides are covered by default extensions
  const defaults = ensureArray(
    typesRoot["Default"] as Record<string, unknown> | Record<string, unknown>[],
  );
  const defaultExtensions = new Set<string>();
  for (const entry of defaults) {
    const ext = entry?.["@_Extension"];
    if (typeof ext === "string") defaultExtensions.add(ext.toLowerCase());
  }

  const zipPaths = Object.keys(zip.files).filter(
    (p) => !zip.files[p].dir,
  );
  for (const zipPath of zipPaths) {
    if (zipPath === "[Content_Types].xml") continue;
    if (zipPath.endsWith(".rels")) continue; // .rels covered by extension default
    if (overridePartNames.has(zipPath)) continue;
    const ext = zipPath.split(".").pop()?.toLowerCase();
    if (ext && !defaultExtensions.has(ext)) {
      issues.push({
        severity: "info",
        code: "UNCOVERED_CONTENT_TYPE",
        message: `File "${zipPath}" has no content type override or default extension mapping for ".${ext}"`,
        path: zipPath,
      });
    }
  }
}

async function validateRelationships(
  zip: JSZip,
  parser: XMLParser,
  issues: ValidationIssue[],
): Promise<void> {
  // Find all .rels files in the ZIP
  const relsPaths = Object.keys(zip.files).filter((p) => p.endsWith(".rels"));

  for (const relsPath of relsPaths) {
    const xml = await readZipText(zip, relsPath);
    if (!xml) continue;

    const result = tryParseXml(xml, parser);
    if ("error" in result) {
      issues.push({
        severity: "error",
        code: "MALFORMED_RELS",
        message: `Relationship file "${relsPath}" is malformed: ${result.error}`,
        path: relsPath,
      });
      continue;
    }

    const rels = extractRelationships(result.data);
    const ownerDir = relsOwnerDir(relsPath);

    for (const rel of rels) {
      // Skip external targets
      if (/^https?:\/\//i.test(rel.target)) continue;
      if (rel.target.startsWith("mailto:")) continue;

      const resolved = resolveRelTarget(ownerDir, rel.target);
      if (!zip.file(resolved)) {
        issues.push({
          severity: "warning",
          code: "DANGLING_RELATIONSHIP",
          message: `Relationship "${rel.id}" in "${relsPath}" targets "${rel.target}" (resolved: "${resolved}") which does not exist`,
          path: relsPath,
        });
      }
    }
  }
}

async function validateSlideXml(
  zip: JSZip,
  parser: XMLParser,
  issues: ValidationIssue[],
): Promise<void> {
  const slidePaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/slides\/slide\d+\.xml$/.test(p),
  );

  for (const slidePath of slidePaths) {
    const xml = await readZipText(zip, slidePath);
    if (!xml) continue;

    const result = tryParseXml(xml, parser);
    if ("error" in result) {
      issues.push({
        severity: "error",
        code: "MALFORMED_SLIDE_XML",
        message: `Slide XML "${slidePath}" is malformed: ${result.error}`,
        path: slidePath,
      });
    }
  }
}

async function validateMediaReferences(
  zip: JSZip,
  parser: XMLParser,
  issues: ValidationIssue[],
): Promise<void> {
  // Collect all media files actually in the archive
  const mediaFiles = new Set(
    Object.keys(zip.files).filter(
      (p) => p.startsWith("ppt/media/") && !zip.files[p].dir,
    ),
  );

  // Scan slide .rels for media relationship targets
  const slideRelsPaths = Object.keys(zip.files).filter(
    (p) => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(p),
  );

  for (const relsPath of slideRelsPaths) {
    const xml = await readZipText(zip, relsPath);
    if (!xml) continue;

    const result = tryParseXml(xml, parser);
    if ("error" in result) continue; // Already flagged elsewhere

    const rels = extractRelationships(result.data);
    const ownerDir = relsOwnerDir(relsPath);

    for (const rel of rels) {
      if (/^https?:\/\//i.test(rel.target)) continue;
      const resolved = resolveRelTarget(ownerDir, rel.target);
      if (
        resolved.startsWith("ppt/media/") &&
        !mediaFiles.has(resolved)
      ) {
        issues.push({
          severity: "warning",
          code: "MISSING_MEDIA",
          message: `Slide references media "${resolved}" which does not exist in the archive`,
          path: relsPath,
        });
      }
    }
  }
}

async function validateTheme(
  zip: JSZip,
  parser: XMLParser,
  issues: ValidationIssue[],
): Promise<void> {
  const themePath = "ppt/theme/theme1.xml";
  const themeFile = zip.file(themePath);
  if (!themeFile) {
    issues.push({
      severity: "warning",
      code: "MISSING_THEME",
      message: `Theme file "${themePath}" is missing from the package`,
      path: themePath,
    });
    return;
  }

  const xml = await themeFile.async("string");
  const result = tryParseXml(xml, parser);
  if ("error" in result) {
    issues.push({
      severity: "error",
      code: "MALFORMED_THEME",
      message: `Theme file "${themePath}" is malformed: ${result.error}`,
      path: themePath,
    });
    return;
  }

  // Check for expected theme elements
  const themeRoot =
    (result.data["a:theme"] as Record<string, unknown>) ?? null;
  if (!themeRoot) {
    issues.push({
      severity: "warning",
      code: "INVALID_THEME_STRUCTURE",
      message: `Theme file "${themePath}" is missing <a:theme> root element`,
      path: themePath,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API: validatePptx
// ---------------------------------------------------------------------------

/**
 * Validate a PPTX file structure without fully loading it.
 *
 * Runs the following checks:
 * 1. Valid ZIP file (can be opened by JSZip)
 * 2. Required files exist: `[Content_Types].xml`, `_rels/.rels`, `ppt/presentation.xml`
 * 3. Content types reference all existing parts
 * 4. Relationships are consistent (no dangling references)
 * 5. Slide XML is well-formed
 * 6. Media files referenced in slides exist in the archive
 * 7. Theme file exists and is valid
 */
export async function validatePptx(
  buffer: ArrayBuffer,
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  const zipResult = await tryOpenZip(buffer);
  if ("error" in zipResult) {
    issues.push({
      severity: "error",
      code: "INVALID_ZIP",
      message: zipResult.error,
    });
    return { valid: false, issues };
  }

  const { zip } = zipResult;
  const parser = createParser();

  await validateZipStructure(zip, issues);
  await validateContentTypes(zip, parser, issues);
  await validateRelationships(zip, parser, issues);
  await validateSlideXml(zip, parser, issues);
  await validateMediaReferences(zip, parser, issues);
  await validateTheme(zip, parser, issues);

  const hasErrors = issues.some((i) => i.severity === "error");
  return { valid: !hasErrors, issues };
}

// ---------------------------------------------------------------------------
// Repair helpers
// ---------------------------------------------------------------------------

/**
 * Rebuild `[Content_Types].xml` from actual ZIP contents.
 */
function rebuildContentTypes(zip: JSZip): string {
  const defaults = new Map<string, string>();
  const overrides: Array<{ partName: string; contentType: string }> = [];

  // Always include rels and xml defaults
  defaults.set("rels", EXTENSION_CONTENT_TYPES.rels);
  defaults.set("xml", EXTENSION_CONTENT_TYPES.xml);

  const zipPaths = Object.keys(zip.files).filter(
    (p) => !zip.files[p].dir && p !== "[Content_Types].xml",
  );

  for (const zipPath of zipPaths) {
    if (zipPath.endsWith(".rels")) continue;

    const normalised = normalisePath(zipPath);

    // Check for well-known part-name overrides
    if (PART_CONTENT_TYPES[normalised]) {
      overrides.push({
        partName: normalised,
        contentType: PART_CONTENT_TYPES[normalised],
      });
      continue;
    }

    // Slides
    if (/^\/ppt\/slides\/slide\d+\.xml$/.test(normalised)) {
      overrides.push({ partName: normalised, contentType: SLIDE_CONTENT_TYPE });
      continue;
    }

    // Slide layouts
    if (/^\/ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(normalised)) {
      overrides.push({
        partName: normalised,
        contentType: SLIDE_LAYOUT_CONTENT_TYPE,
      });
      continue;
    }

    // Slide masters
    if (/^\/ppt\/slideMasters\/slideMaster\d+\.xml$/.test(normalised)) {
      overrides.push({
        partName: normalised,
        contentType: SLIDE_MASTER_CONTENT_TYPE,
      });
      continue;
    }

    // Theme
    if (/^\/ppt\/theme\/theme\d+\.xml$/.test(normalised)) {
      overrides.push({ partName: normalised, contentType: THEME_CONTENT_TYPE });
      continue;
    }

    // For everything else, ensure the extension has a default
    const ext = zipPath.split(".").pop()?.toLowerCase();
    if (ext && EXTENSION_CONTENT_TYPES[ext] && !defaults.has(ext)) {
      defaults.set(ext, EXTENSION_CONTENT_TYPES[ext]);
    }
  }

  const defaultEntries = Array.from(defaults.entries())
    .map(
      ([ext, ct]) =>
        `  <Default Extension="${ext}" ContentType="${ct}"/>`,
    )
    .join("\n");

  const overrideEntries = overrides
    .map(
      (o) =>
        `  <Override PartName="${o.partName}" ContentType="${o.contentType}"/>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
${defaultEntries}
${overrideEntries}
</Types>`;
}

/**
 * Remove dangling relationship references from a .rels XML string.
 * Returns the cleaned XML and the IDs of removed relationships.
 */
function removeDanglingRels(
  xml: string,
  zip: JSZip,
  relsPath: string,
  parser: XMLParser,
): { xml: string; removedIds: string[] } {
  const result = tryParseXml(xml, parser);
  if ("error" in result) return { xml, removedIds: [] };

  const rels = extractRelationships(result.data);
  const ownerDir = relsOwnerDir(relsPath);
  const removedIds: string[] = [];
  const keptRels: Array<{ id: string; type: string; target: string }> = [];

  for (const rel of rels) {
    if (
      /^https?:\/\//i.test(rel.target) ||
      rel.target.startsWith("mailto:")
    ) {
      keptRels.push(rel);
      continue;
    }

    const resolved = resolveRelTarget(ownerDir, rel.target);
    if (zip.file(resolved)) {
      keptRels.push(rel);
    } else {
      removedIds.push(rel.id);
    }
  }

  if (removedIds.length === 0) return { xml, removedIds: [] };

  // Rebuild the XML
  const relEntries = keptRels
    .map(
      (r) =>
        `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`,
    )
    .join("\n");

  const rebuilt = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relEntries}
</Relationships>`;

  return { xml: rebuilt, removedIds };
}

/**
 * Add missing relationship entries for discovered parts that exist in
 * the ZIP but are not referenced by any .rels file.
 */
async function addMissingRelationships(
  zip: JSZip,
  parser: XMLParser,
  repairs: string[],
): Promise<void> {
  // Check root .rels for presentation.xml reference
  const rootRelsPath = "_rels/.rels";
  const rootRelsXml = await readZipText(zip, rootRelsPath);
  if (!rootRelsXml) {
    // Create a minimal root .rels if the file exists elsewhere
    if (zip.file("ppt/presentation.xml")) {
      const newRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;
      zip.file(rootRelsPath, newRels);
      repairs.push("Created missing _rels/.rels with presentation.xml relationship");
    }
    return;
  }

  const result = tryParseXml(rootRelsXml, parser);
  if ("error" in result) return;

  const rels = extractRelationships(result.data);
  const hasPresentation = rels.some(
    (r) =>
      r.type ===
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
  );

  if (!hasPresentation && zip.file("ppt/presentation.xml")) {
    // Find a new rId
    const usedIds = new Set(rels.map((r) => r.id));
    let newId = 1;
    while (usedIds.has(`rId${newId}`)) newId++;

    rels.push({
      id: `rId${newId}`,
      type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
      target: "ppt/presentation.xml",
    });

    const relEntries = rels
      .map(
        (r) =>
          `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`,
      )
      .join("\n");
    const rebuilt = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relEntries}
</Relationships>`;

    zip.file(rootRelsPath, rebuilt);
    repairs.push(
      "Added missing officeDocument relationship to _rels/.rels",
    );
  }
}

/**
 * Attempt basic XML fixes: close unclosed self-closing tags.
 * This is intentionally conservative — only fixes patterns like
 * `<tag attr="val">` that should be `<tag attr="val"/>`.
 */
function fixMalformedXml(xml: string): { fixed: string; didFix: boolean } {
  // Fix unclosed self-closing tags for known empty elements
  // Pattern: match tags that are opened but have no closing tag and no content
  const emptyElements = [
    "a:off",
    "a:ext",
    "a:chOff",
    "a:chExt",
    "a:srgbClr",
    "a:schemeClr",
    "a:latin",
    "a:ea",
    "a:cs",
    "a:buNone",
    "a:noFill",
    "a:defRPr",
  ];

  let fixed = xml;
  let didFix = false;

  for (const tag of emptyElements) {
    // Match opening tags that aren't self-closed and aren't followed by content/closing
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `(<${escapedTag}(?:\\s[^>]*)?)>(?=\\s*<(?!/${escapedTag}))`,
      "g",
    );

    const replaced = fixed.replace(pattern, (match, openTag) => {
      // Only fix if the tag doesn't already self-close
      if (openTag.endsWith("/")) return match;
      didFix = true;
      return `${openTag}/>`;
    });
    fixed = replaced;
  }

  return { fixed, didFix };
}

// ---------------------------------------------------------------------------
// Public API: repairPptx
// ---------------------------------------------------------------------------

/**
 * Attempt to repair common PPTX issues.
 *
 * Repair operations:
 * 1. Rebuild `[Content_Types].xml` from actual ZIP contents
 * 2. Remove dangling relationship references
 * 3. Add missing relationships for discovered parts
 * 4. Fix malformed XML (close unclosed tags - basic)
 */
export async function repairPptx(
  buffer: ArrayBuffer,
): Promise<RepairResult> {
  const repairs: string[] = [];

  const zipResult = await tryOpenZip(buffer);
  if ("error" in zipResult) {
    throw new Error(
      `Cannot repair: file is not a valid ZIP archive. ${zipResult.error}`,
    );
  }

  const { zip } = zipResult;
  const parser = createParser();

  // 1. Rebuild [Content_Types].xml
  const existingCt = await readZipText(zip, "[Content_Types].xml");
  const rebuilt = rebuildContentTypes(zip);

  if (!existingCt) {
    repairs.push("Created missing [Content_Types].xml");
  } else if (existingCt.trim() !== rebuilt.trim()) {
    repairs.push("Rebuilt [Content_Types].xml from actual ZIP contents");
  }
  zip.file("[Content_Types].xml", rebuilt);

  // 2. Remove dangling relationship references
  const relsPaths = Object.keys(zip.files).filter((p) =>
    p.endsWith(".rels"),
  );
  for (const relsPath of relsPaths) {
    const xml = await readZipText(zip, relsPath);
    if (!xml) continue;

    const { xml: cleaned, removedIds } = removeDanglingRels(
      xml,
      zip,
      relsPath,
      parser,
    );
    if (removedIds.length > 0) {
      zip.file(relsPath, cleaned);
      repairs.push(
        `Removed ${removedIds.length} dangling relationship(s) from "${relsPath}": ${removedIds.join(", ")}`,
      );
    }
  }

  // 3. Add missing relationships
  await addMissingRelationships(zip, parser, repairs);

  // 4. Fix malformed XML in slides
  const xmlPaths = Object.keys(zip.files).filter(
    (p) => p.endsWith(".xml") && !zip.files[p].dir,
  );
  for (const xmlPath of xmlPaths) {
    const xml = await readZipText(zip, xmlPath);
    if (!xml) continue;

    const { fixed, didFix } = fixMalformedXml(xml);
    if (didFix) {
      zip.file(xmlPath, fixed);
      repairs.push(`Fixed malformed XML in "${xmlPath}"`);
    }
  }

  const repairedBuffer = await zip.generateAsync({ type: "arraybuffer" });
  return { repaired: repairedBuffer, repairs };
}
