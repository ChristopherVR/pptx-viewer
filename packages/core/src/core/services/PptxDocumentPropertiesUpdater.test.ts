import { describe, it, expect, vi, beforeEach } from "vitest";
import { XMLParser, XMLBuilder } from "fast-xml-parser";
import JSZip from "jszip";
import {
  PptxDocumentPropertiesUpdater,
  type PptxDocumentPropertiesUpdaterContext,
} from "./PptxDocumentPropertiesUpdater";
import type { PptxSlide } from "../types";

const xmlParserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
};

function createContext(): PptxDocumentPropertiesUpdaterContext {
  return {
    zip: new JSZip(),
    parser: new XMLParser(xmlParserOptions),
    builder: new XMLBuilder(xmlParserOptions),
  };
}

function makeSlide(overrides: Partial<PptxSlide> = {}): PptxSlide {
  return {
    id: "ppt/slides/slide1.xml",
    rId: "rId1",
    slideNumber: 1,
    hidden: false,
    elements: [],
    rawXml: {},
    ...overrides,
  } as PptxSlide;
}

describe("PptxDocumentPropertiesUpdater", () => {
  let context: PptxDocumentPropertiesUpdaterContext;
  let updater: PptxDocumentPropertiesUpdater;

  beforeEach(() => {
    context = createContext();
    updater = new PptxDocumentPropertiesUpdater(context);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  // ── updateOnSave: core properties ────────────────────────────────

  describe("updateOnSave — core properties", () => {
    it("increments the revision number", async () => {
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>3</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
      context.zip.file("docProps/core.xml", coreXml);

      await updater.updateOnSave([makeSlide()]);

      const updatedXml = await context.zip
        .file("docProps/core.xml")!
        .async("string");
      expect(updatedXml).toContain("4"); // revision 3 -> 4
    });

    it("sets revision to 1 when no valid revision exists", async () => {
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
      context.zip.file("docProps/core.xml", coreXml);

      await updater.updateOnSave([makeSlide()]);

      const updatedXml = await context.zip
        .file("docProps/core.xml")!
        .async("string");
      // Should contain revision of "1"
      expect(updatedXml).toContain("1");
    });

    it("updates the modified date", async () => {
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
      context.zip.file("docProps/core.xml", coreXml);

      await updater.updateOnSave([makeSlide()]);

      const updatedXml = await context.zip
        .file("docProps/core.xml")!
        .async("string");
      // Should no longer have the old date
      expect(updatedXml).not.toContain("2024-01-01T00:00:00Z");
    });

    it("applies core property overrides", async () => {
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dc:title>Old Title</dc:title>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
      context.zip.file("docProps/core.xml", coreXml);

      await updater.updateOnSave([makeSlide()], {
        coreProperties: {
          title: "New Title",
          creator: "Test Author",
        },
      });

      const updatedXml = await context.zip
        .file("docProps/core.xml")!
        .async("string");
      expect(updatedXml).toContain("New Title");
      expect(updatedXml).toContain("Test Author");
    });
  });

  // ── updateOnSave: app properties ──────────────────────────────────

  describe("updateOnSave — app properties", () => {
    it("updates slide count in app properties", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      const slides = [makeSlide(), makeSlide({ id: "s2", slideNumber: 2 })];
      await updater.updateOnSave(slides);

      const updatedXml = await context.zip
        .file("docProps/app.xml")!
        .async("string");
      expect(updatedXml).toContain("2"); // 2 slides
    });

    it("counts hidden slides", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>2</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      const slides = [
        makeSlide({ hidden: true }),
        makeSlide({ id: "s2", slideNumber: 2, hidden: false }),
      ];
      await updater.updateOnSave(slides);

      const updatedXml = await context.zip
        .file("docProps/app.xml")!
        .async("string");
      // Should reflect 1 hidden slide
      const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
      const props = parsed["Properties"] as Record<string, unknown>;
      expect(String(props["HiddenSlides"])).toBe("1");
    });

    it("counts slides with notes", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>2</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      const slides = [
        makeSlide({ notes: "Speaker notes here" }),
        makeSlide({ id: "s2", slideNumber: 2, notes: "" }),
      ];
      await updater.updateOnSave(slides);

      const updatedXml = await context.zip
        .file("docProps/app.xml")!
        .async("string");
      const parsed = context.parser.parse(updatedXml) as Record<string, unknown>;
      const props = parsed["Properties"] as Record<string, unknown>;
      expect(String(props["Notes"])).toBe("1");
    });

    it("applies app property overrides", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
          <Company>OldCo</Company>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      await updater.updateOnSave([makeSlide()], {
        appProperties: {
          company: "NewCo",
          application: "TestApp",
        },
      });

      const updatedXml = await context.zip
        .file("docProps/app.xml")!
        .async("string");
      expect(updatedXml).toContain("NewCo");
      expect(updatedXml).toContain("TestApp");
    });

    it("does nothing when app.xml is missing", async () => {
      // No docProps/app.xml in the zip
      const coreXml = `<?xml version="1.0"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <cp:revision>1</cp:revision>
          <dcterms:modified xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:modified>
        </cp:coreProperties>`;
      context.zip.file("docProps/core.xml", coreXml);

      // Should not throw
      await updater.updateOnSave([makeSlide()]);
    });
  });

  // ── updateOnSave: custom properties ───────────────────────────────

  describe("updateOnSave — custom properties", () => {
    it("writes custom properties to custom.xml", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      await updater.updateOnSave([makeSlide()], {
        customProperties: [
          { name: "ProjectId", value: "12345", type: "lpwstr" },
          { name: "Version", value: "2", type: "i4" },
        ],
      });

      const customXml = await context.zip
        .file("docProps/custom.xml")!
        .async("string");
      expect(customXml).toContain("ProjectId");
      expect(customXml).toContain("12345");
      expect(customXml).toContain("Version");
    });

    it("removes custom.xml when custom properties list is empty", async () => {
      context.zip.file("docProps/custom.xml", "<old/>");
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      await updater.updateOnSave([makeSlide()], {
        customProperties: [],
      });

      expect(context.zip.file("docProps/custom.xml")).toBeNull();
    });

    it("filters out properties with empty names", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      await updater.updateOnSave([makeSlide()], {
        customProperties: [
          { name: "", value: "ignored", type: "lpwstr" },
          { name: "  ", value: "also ignored", type: "lpwstr" },
        ],
      });

      // Should remove custom.xml since no valid properties remain
      expect(context.zip.file("docProps/custom.xml")).toBeNull();
    });

    it("normalizes unknown custom property types to lpwstr", async () => {
      const appXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Slides>1</Slides>
          <HiddenSlides>0</HiddenSlides>
          <Notes>0</Notes>
        </Properties>`;
      context.zip.file("docProps/app.xml", appXml);

      await updater.updateOnSave([makeSlide()], {
        customProperties: [
          { name: "Prop1", value: "val", type: "unknownType" },
        ],
      });

      const customXml = await context.zip
        .file("docProps/custom.xml")!
        .async("string");
      expect(customXml).toContain("lpwstr");
    });
  });
});
