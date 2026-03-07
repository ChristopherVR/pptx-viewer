import type { IFactory } from "./types";

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
}

export class PptxSaveConstantsFactory implements IFactory<PptxSaveConstants> {
  public create(): PptxSaveConstants {
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
    };
  }
}

const defaultPptxSaveConstantsFactory = new PptxSaveConstantsFactory();

export const createPptxSaveConstants = (): PptxSaveConstants =>
  defaultPptxSaveConstantsFactory.create();
