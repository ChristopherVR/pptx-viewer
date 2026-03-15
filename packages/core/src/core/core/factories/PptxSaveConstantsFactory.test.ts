import { describe, it, expect } from "vitest";
import { PptxSaveConstantsFactory, createPptxSaveConstants } from "./PptxSaveConstantsFactory";

describe("PptxSaveConstantsFactory", () => {
  const factory = new PptxSaveConstantsFactory();

  describe("create() with transitional conformance", () => {
    it("returns transitional namespace URIs by default", () => {
      const constants = factory.create();
      expect(constants.conformance).toBe("transitional");
      expect(constants.slideRelationshipType).toContain("schemas.openxmlformats.org");
      expect(constants.relationshipsNamespace).toContain("schemas.openxmlformats.org");
    });

    it("returns transitional slide relationship type", () => {
      const constants = factory.create("transitional");
      expect(constants.slideRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide");
    });

    it("returns transitional slide layout relationship type", () => {
      const constants = factory.create("transitional");
      expect(constants.slideLayoutRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout");
    });

    it("returns transitional relationships namespace", () => {
      const constants = factory.create("transitional");
      expect(constants.relationshipsNamespace)
        .toBe("http://schemas.openxmlformats.org/package/2006/relationships");
    });

    it("returns transitional image relationship type", () => {
      const constants = factory.create("transitional");
      expect(constants.slideImageRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/image");
    });

    it("returns transitional media relationship types", () => {
      const constants = factory.create("transitional");
      expect(constants.slideMediaRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/media");
      expect(constants.slideVideoRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/video");
      expect(constants.slideAudioRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio");
    });

    it("returns transitional comment relationship type", () => {
      const constants = factory.create("transitional");
      expect(constants.slideCommentRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments");
    });

    it("returns transitional notes relationship type", () => {
      const constants = factory.create("transitional");
      expect(constants.slideNotesRelationshipType)
        .toBe("http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide");
    });
  });

  describe("create() with strict conformance", () => {
    it("returns strict namespace URIs", () => {
      const constants = factory.create("strict");
      expect(constants.conformance).toBe("strict");
      expect(constants.slideRelationshipType).toContain("purl.oclc.org");
      expect(constants.relationshipsNamespace).toContain("purl.oclc.org");
    });

    it("returns strict slide relationship type", () => {
      const constants = factory.create("strict");
      expect(constants.slideRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/slide");
    });

    it("returns strict slide layout relationship type", () => {
      const constants = factory.create("strict");
      expect(constants.slideLayoutRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout");
    });

    it("returns strict relationships namespace", () => {
      const constants = factory.create("strict");
      expect(constants.relationshipsNamespace)
        .toBe("http://purl.oclc.org/ooxml/package/relationships");
    });

    it("returns strict image relationship type", () => {
      const constants = factory.create("strict");
      expect(constants.slideImageRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/image");
    });

    it("returns strict media relationship types", () => {
      const constants = factory.create("strict");
      expect(constants.slideMediaRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/media");
      expect(constants.slideVideoRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/video");
      expect(constants.slideAudioRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/audio");
    });

    it("returns strict comment relationship type", () => {
      const constants = factory.create("strict");
      expect(constants.slideCommentRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/comments");
    });

    it("returns strict notes relationship type", () => {
      const constants = factory.create("strict");
      expect(constants.slideNotesRelationshipType)
        .toBe("http://purl.oclc.org/ooxml/officeDocument/relationships/notesSlide");
    });

    it("uses the same content types for both conformance classes", () => {
      const strict = factory.create("strict");
      const transitional = factory.create("transitional");
      expect(strict.slideContentType).toBe(transitional.slideContentType);
      expect(strict.commentContentType).toBe(transitional.commentContentType);
      expect(strict.commentAuthorContentType).toBe(transitional.commentAuthorContentType);
      expect(strict.commentAuthorsPartName).toBe(transitional.commentAuthorsPartName);
    });
  });

  describe("default parameter", () => {
    it("defaults to transitional when no argument is provided", () => {
      const constants = factory.create();
      expect(constants.conformance).toBe("transitional");
    });

    it("defaults to transitional when undefined is passed", () => {
      const constants = factory.create(undefined);
      expect(constants.conformance).toBe("transitional");
    });
  });
});

describe("createPptxSaveConstants helper", () => {
  it("returns transitional constants by default", () => {
    const constants = createPptxSaveConstants();
    expect(constants.conformance).toBe("transitional");
    expect(constants.slideRelationshipType).toContain("schemas.openxmlformats.org");
  });

  it("returns strict constants when asked", () => {
    const constants = createPptxSaveConstants("strict");
    expect(constants.conformance).toBe("strict");
    expect(constants.slideRelationshipType).toContain("purl.oclc.org");
  });

  it("returns transitional constants when explicitly asked", () => {
    const constants = createPptxSaveConstants("transitional");
    expect(constants.conformance).toBe("transitional");
    expect(constants.slideRelationshipType).toContain("schemas.openxmlformats.org");
  });
});
