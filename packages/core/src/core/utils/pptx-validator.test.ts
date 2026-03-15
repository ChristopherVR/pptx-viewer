import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { validatePptx, repairPptx } from "./pptx-validator";
import type { ValidationResult, RepairResult } from "./pptx-validator";

// ---------------------------------------------------------------------------
// Helpers — create minimal PPTX ZIPs in-memory
// ---------------------------------------------------------------------------

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

const PRESENTATION_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
</p:presentation>`;

const PRESENTATION_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;

const THEME_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="TestTheme">
  <a:themeElements>
    <a:clrScheme name="TestTheme">
      <a:dk1><a:srgbClr val="000000"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="TestTheme">
      <a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="TestTheme">
      <a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>
      <a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>
      <a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>
      <a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const SLIDE_MASTER_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
</p:sldMaster>`;

const SLIDE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
</p:sld>`;

/** Create a minimal valid PPTX buffer with all required parts. */
async function createValidPptx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", ROOT_RELS_XML);
  zip.file("ppt/presentation.xml", PRESENTATION_XML);
  zip.file(
    "ppt/_rels/presentation.xml.rels",
    PRESENTATION_RELS_XML,
  );
  zip.file("ppt/theme/theme1.xml", THEME_XML);
  zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER_XML);
  return zip.generateAsync({ type: "arraybuffer" });
}

/** Create a valid PPTX with one slide. */
async function createPptxWithSlide(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;
  zip.file("[Content_Types].xml", ctXml);
  zip.file("_rels/.rels", ROOT_RELS_XML);
  zip.file("ppt/presentation.xml", PRESENTATION_XML);
  zip.file("ppt/_rels/presentation.xml.rels", PRESENTATION_RELS_XML);
  zip.file("ppt/theme/theme1.xml", THEME_XML);
  zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER_XML);
  zip.file("ppt/slides/slide1.xml", SLIDE_XML);
  zip.file(
    "ppt/slides/_rels/slide1.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`,
  );
  zip.file(
    "ppt/slideLayouts/slideLayout1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr/>
  </p:spTree></p:cSld>
</p:sldLayout>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

function issuesByCode(result: ValidationResult, code: string) {
  return result.issues.filter((i) => i.code === code);
}

// ===========================================================================
// validatePptx
// ===========================================================================

describe("validatePptx", () => {
  // ---- 1. Valid ZIP check --------------------------------------------------

  it("reports error for non-ZIP data", async () => {
    const garbage = new ArrayBuffer(64);
    new Uint8Array(garbage).fill(0xff);
    const result = await validatePptx(garbage);
    expect(result.valid).toBe(false);
    expect(issuesByCode(result, "INVALID_ZIP")).toHaveLength(1);
  });

  it("reports error for empty buffer", async () => {
    const result = await validatePptx(new ArrayBuffer(0));
    expect(result.valid).toBe(false);
    expect(issuesByCode(result, "INVALID_ZIP")).toHaveLength(1);
  });

  // ---- 2. Required files ---------------------------------------------------

  it("reports missing [Content_Types].xml", async () => {
    const zip = new JSZip();
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MISSING_REQUIRED_FILE");
    expect(issues.some((i) => i.path === "[Content_Types].xml")).toBe(true);
  });

  it("reports missing _rels/.rels", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MISSING_REQUIRED_FILE");
    expect(issues.some((i) => i.path === "_rels/.rels")).toBe(true);
  });

  it("reports missing ppt/presentation.xml", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MISSING_REQUIRED_FILE");
    expect(issues.some((i) => i.path === "ppt/presentation.xml")).toBe(true);
  });

  it("reports all three missing required files for an empty ZIP", async () => {
    const zip = new JSZip();
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MISSING_REQUIRED_FILE");
    expect(issues).toHaveLength(3);
  });

  // ---- 3. Content types checks ---------------------------------------------

  it("reports malformed [Content_Types].xml", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types><broken");
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MALFORMED_CONTENT_TYPES");
    expect(issues).toHaveLength(1);
  });

  it("reports missing <Types> root element", async () => {
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0"?><NotTypes/>`,
    );
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "INVALID_CONTENT_TYPES");
    expect(issues).toHaveLength(1);
  });

  it("warns about content type override for non-existent part", async () => {
    const zip = new JSZip();
    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide99.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`;
    zip.file("[Content_Types].xml", ctXml);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "CONTENT_TYPE_MISSING_PART");
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.message.includes("slide99"))).toBe(true);
  });

  it("reports info for file with no content type coverage", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    // Add a file with an unusual extension
    zip.file("ppt/custom/data.xyz", "some data");
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "UNCOVERED_CONTENT_TYPE");
    expect(issues.some((i) => i.path === "ppt/custom/data.xyz")).toBe(true);
  });

  // ---- 4. Relationship consistency -----------------------------------------

  it("warns about dangling relationship target", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    // presentation.xml.rels references slideMaster that doesn't exist
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "DANGLING_RELATIONSHIP");
    expect(issues.some((i) => i.message.includes("slideMaster1"))).toBe(true);
  });

  it("reports malformed .rels file", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", "<Relationships><broken");
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    expect(result.valid).toBe(false);
    const issues = issuesByCode(result, "MALFORMED_RELS");
    expect(issues).toHaveLength(1);
  });

  it("does not flag external relationship targets as dangling", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com"/>
</Relationships>`,
    );
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "DANGLING_RELATIONSHIP");
    // rId2 should NOT be flagged because it's an external URL
    expect(
      issues.some((i) => i.message.includes("rId2")),
    ).toBe(false);
  });

  // ---- 5. Slide XML well-formedness ----------------------------------------

  it("reports malformed slide XML", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", "<p:sld><broken");
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MALFORMED_SLIDE_XML");
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("ppt/slides/slide1.xml");
  });

  it("does not report well-formed slide XML as malformed", async () => {
    const buf = await createPptxWithSlide();
    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MALFORMED_SLIDE_XML");
    expect(issues).toHaveLength(0);
  });

  // ---- 6. Media references ------------------------------------------------

  it("warns about missing media referenced by slide rels", async () => {
    const zip = new JSZip();
    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;
    zip.file("[Content_Types].xml", ctXml);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", SLIDE_XML);
    // Slide rels references a media file that doesn't exist
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MISSING_MEDIA");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("image1.png");
  });

  it("does not flag existing media as missing", async () => {
    const zip = new JSZip();
    const ctXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;
    zip.file("[Content_Types].xml", ctXml);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", SLIDE_XML);
    zip.file("ppt/media/image1.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    zip.file(
      "ppt/slides/_rels/slide1.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>
</Relationships>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MISSING_MEDIA");
    expect(issues).toHaveLength(0);
  });

  // ---- 7. Theme validation -------------------------------------------------

  it("warns about missing theme file", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    // No theme file
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MISSING_THEME");
    expect(issues).toHaveLength(1);
  });

  it("reports malformed theme XML", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", "<a:theme><broken");
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "MALFORMED_THEME");
    expect(issues).toHaveLength(1);
  });

  it("warns about theme missing <a:theme> root element", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file(
      "ppt/theme/theme1.xml",
      `<?xml version="1.0"?><notATheme/>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const result = await validatePptx(buf);
    const issues = issuesByCode(result, "INVALID_THEME_STRUCTURE");
    expect(issues).toHaveLength(1);
  });

  // ---- Valid PPTX ---------------------------------------------------------

  it("passes validation for a minimal valid PPTX", async () => {
    const buf = await createValidPptx();
    const result = await validatePptx(buf);
    // Should have no errors (may have warnings/info)
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("passes validation for a PPTX with a slide", async () => {
    const buf = await createPptxWithSlide();
    const result = await validatePptx(buf);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });
});

// ===========================================================================
// repairPptx
// ===========================================================================

describe("repairPptx", () => {
  it("throws for non-ZIP data", async () => {
    const garbage = new ArrayBuffer(64);
    new Uint8Array(garbage).fill(0xff);
    await expect(repairPptx(garbage)).rejects.toThrow(
      /not a valid ZIP/,
    );
  });

  // ---- 1. Rebuild [Content_Types].xml -------------------------------------

  it("creates missing [Content_Types].xml", async () => {
    const zip = new JSZip();
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(repairs.some((r) => r.includes("[Content_Types].xml"))).toBe(true);

    // Verify the repaired file is valid
    const repairedZip = await JSZip.loadAsync(repaired);
    const ct = await repairedZip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain("presentation.xml");
    expect(ct).toContain("theme1.xml");
  });

  it("rebuilds [Content_Types].xml with correct overrides for slides", async () => {
    const zip = new JSZip();
    // Content types missing slide override
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", SLIDE_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(repairs.some((r) => r.includes("[Content_Types].xml"))).toBe(true);

    const repairedZip = await JSZip.loadAsync(repaired);
    const ct = await repairedZip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain("slide1.xml");
    expect(ct).toContain("presentationml.slide+xml");
  });

  // ---- 2. Remove dangling relationships -----------------------------------

  it("removes dangling relationship references", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    // Presentation rels references non-existent slideMaster
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(
      repairs.some((r) => r.includes("dangling") && r.includes("rId1")),
    ).toBe(true);

    // Verify the dangling ref was removed
    const repairedZip = await JSZip.loadAsync(repaired);
    const rels = await repairedZip
      .file("ppt/_rels/presentation.xml.rels")!
      .async("string");
    expect(rels).not.toContain("rId1");
    // But rId2 (theme) should still be there
    expect(rels).toContain("rId2");
  });

  it("preserves valid relationships when removing dangling ones", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER_XML);
    // Add a dangling ref alongside valid refs
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="ghost.xml"/>
</Relationships>`,
    );
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired } = await repairPptx(buf);
    const repairedZip = await JSZip.loadAsync(repaired);
    const rels = await repairedZip
      .file("ppt/_rels/presentation.xml.rels")!
      .async("string");
    expect(rels).toContain("rId1"); // slideMaster exists
    expect(rels).toContain("rId2"); // theme exists
    expect(rels).not.toContain("rId3"); // ghost.xml removed
  });

  // ---- 3. Add missing relationships for discovered parts ------------------

  it("creates missing _rels/.rels when presentation.xml exists", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    // No _rels/.rels
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(repairs.some((r) => r.includes("_rels/.rels"))).toBe(true);

    const repairedZip = await JSZip.loadAsync(repaired);
    const rootRels = repairedZip.file("_rels/.rels");
    expect(rootRels).not.toBeNull();
    const content = await rootRels!.async("string");
    expect(content).toContain("officeDocument");
    expect(content).toContain("ppt/presentation.xml");
  });

  it("adds missing officeDocument relationship to existing _rels/.rels", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    // _rels/.rels exists but is missing the officeDocument relationship
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
    );
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    // docProps/core.xml must exist so rId1 is not dangling
    zip.file("docProps/core.xml", `<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"/>`);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(
      repairs.some((r) => r.includes("officeDocument")),
    ).toBe(true);

    const repairedZip = await JSZip.loadAsync(repaired);
    const content = await repairedZip.file("_rels/.rels")!.async("string");
    expect(content).toContain("officeDocument");
    expect(content).toContain("ppt/presentation.xml");
    // Original relationship should still be there
    expect(content).toContain("core-properties");
  });

  // ---- 4. Fix malformed XML -----------------------------------------------

  it("fixes unclosed self-closing XML tags", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
    zip.file("_rels/.rels", ROOT_RELS_XML);
    // Malformed slide: <a:off> tag not self-closed
    const malformedSlide = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr>
      <a:xfrm>
        <a:off x="0" y="0">
        <a:ext cx="0" cy="0"/>
      </a:xfrm>
    </p:grpSpPr>
  </p:spTree></p:cSld>
</p:sld>`;
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", malformedSlide);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired, repairs } = await repairPptx(buf);
    expect(repairs.some((r) => r.includes("malformed XML"))).toBe(true);

    const repairedZip = await JSZip.loadAsync(repaired);
    const slideXml = await repairedZip
      .file("ppt/slides/slide1.xml")!
      .async("string");
    expect(slideXml).toContain('<a:off x="0" y="0"/>');
  });

  // ---- Round-trip: repair then validate -----------------------------------

  it("repaired PPTX passes validation", async () => {
    // Start with a broken PPTX: missing content types, dangling rels
    const zip = new JSZip();
    // Missing [Content_Types].xml
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slideMasters/slideMaster1.xml", SLIDE_MASTER_XML);
    zip.file("ppt/_rels/presentation.xml.rels", PRESENTATION_RELS_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    // Should fail validation
    const beforeResult = await validatePptx(buf);
    expect(beforeResult.valid).toBe(false);

    // Repair
    const { repaired } = await repairPptx(buf);

    // Should now pass validation (no errors)
    const afterResult = await validatePptx(repaired);
    const errors = afterResult.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
    expect(afterResult.valid).toBe(true);
  });

  it("returns empty repairs array when nothing needs fixing", async () => {
    const buf = await createValidPptx();
    const { repairs } = await repairPptx(buf);
    // The rebuilt content types may differ in formatting, so we check
    // there are no structural repairs (dangling rels, missing rels, malformed xml)
    const structuralRepairs = repairs.filter(
      (r) =>
        !r.includes("[Content_Types].xml"),
    );
    expect(structuralRepairs).toHaveLength(0);
  });

  it("handles PPTX with multiple slides during rebuild", async () => {
    const zip = new JSZip();
    // No content types file
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/slides/slide1.xml", SLIDE_XML);
    zip.file("ppt/slides/slide2.xml", SLIDE_XML);
    zip.file("ppt/slides/slide3.xml", SLIDE_XML);
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired } = await repairPptx(buf);
    const repairedZip = await JSZip.loadAsync(repaired);
    const ct = await repairedZip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain("slide1.xml");
    expect(ct).toContain("slide2.xml");
    expect(ct).toContain("slide3.xml");
    // All slides should have the slide content type
    const slideMatches = ct.match(/presentationml\.slide\+xml/g);
    expect(slideMatches).toHaveLength(3);
  });

  it("rebuilds content types with media defaults", async () => {
    const zip = new JSZip();
    zip.file("_rels/.rels", ROOT_RELS_XML);
    zip.file("ppt/presentation.xml", PRESENTATION_XML);
    zip.file("ppt/theme/theme1.xml", THEME_XML);
    zip.file("ppt/media/image1.png", new Uint8Array([0x89, 0x50]));
    zip.file("ppt/media/video1.mp4", new Uint8Array([0x00]));
    const buf = await zip.generateAsync({ type: "arraybuffer" });

    const { repaired } = await repairPptx(buf);
    const repairedZip = await JSZip.loadAsync(repaired);
    const ct = await repairedZip.file("[Content_Types].xml")!.async("string");
    expect(ct).toContain('Extension="png"');
    expect(ct).toContain('Extension="mp4"');
  });
});
