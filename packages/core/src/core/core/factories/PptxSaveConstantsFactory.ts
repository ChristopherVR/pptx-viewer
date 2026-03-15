import type { IFactory } from "./types";
import type { OoxmlConformanceClass } from "../../utils";

export interface PptxSaveConstants {
  slideRelationshipType: string;
  slideLayoutRelationshipType: string;
  slideImageRelationshipType: string;
  slideMediaRelationshipType: string;
  slideVideoRelationshipType: string;
  slideAudioRelationshipType: string;
  slideCommentRelationshipType: string;
  slideNotesRelationshipType: string;
  relationshipsNamespace: string;
  slideContentType: string;
  commentContentType: string;
  commentAuthorContentType: string;
  commentAuthorsPartName: string;
  /** The resolved conformance class for the save operation. */
  conformance: OoxmlConformanceClass;
}

export class PptxSaveConstantsFactory implements IFactory<PptxSaveConstants, OoxmlConformanceClass | undefined> {
  public create(conformance: OoxmlConformanceClass = "transitional"): PptxSaveConstants {
    if (conformance === "strict") {
      return {
        slideRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/slide",
        slideLayoutRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout",
        slideImageRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/image",
        slideMediaRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/media",
        slideVideoRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/video",
        slideAudioRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/audio",
        slideCommentRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/comments",
        slideNotesRelationshipType:
          "http://purl.oclc.org/ooxml/officeDocument/relationships/notesSlide",
        relationshipsNamespace:
          "http://purl.oclc.org/ooxml/package/relationships",
        // Content types are NOT namespace-dependent; they stay the same
        // in both Strict and Transitional conformance.
        slideContentType:
          "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
        commentContentType:
          "application/vnd.openxmlformats-officedocument.presentationml.comments+xml",
        commentAuthorContentType:
          "application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml",
        commentAuthorsPartName: "/ppt/commentAuthors.xml",
        conformance: "strict",
      };
    }

    return {
      slideRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide",
      slideLayoutRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout",
      slideImageRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
      slideMediaRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/media",
      slideVideoRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/video",
      slideAudioRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio",
      slideCommentRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments",
      slideNotesRelationshipType:
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide",
      relationshipsNamespace:
        "http://schemas.openxmlformats.org/package/2006/relationships",
      slideContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
      commentContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.comments+xml",
      commentAuthorContentType:
        "application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml",
      commentAuthorsPartName: "/ppt/commentAuthors.xml",
      conformance: "transitional",
    };
  }
}

const defaultPptxSaveConstantsFactory = new PptxSaveConstantsFactory();

export const createPptxSaveConstants = (
  conformance: OoxmlConformanceClass = "transitional",
): PptxSaveConstants => defaultPptxSaveConstantsFactory.create(conformance);
