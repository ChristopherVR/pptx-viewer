import type { XmlObject } from './common';

export interface PptxEmbeddedFontDataId {
	/** Required relationship identifier from `r:id`. */
	relationshipId?: string | null;
	/** Original leaf retained for unknown attribute preservation. */
	rawXml?: XmlObject;
}

export interface PptxEmbeddedFontDescriptor {
	typeface?: string | null;
	panose?: string | null;
	pitchFamily?: string | null;
	charset?: string | null;
	rawXml?: XmlObject;
}

export interface PptxEmbeddedFontListEntry {
	font: PptxEmbeddedFontDescriptor;
	regular?: PptxEmbeddedFontDataId | null;
	bold?: PptxEmbeddedFontDataId | null;
	italic?: PptxEmbeddedFontDataId | null;
	boldItalic?: PptxEmbeddedFontDataId | null;
	rawXml?: XmlObject;
}

export interface PptxEmbeddedFontList {
	fonts: PptxEmbeddedFontListEntry[];
	/** Original list retained for unknown attribute and child preservation. */
	rawXml?: XmlObject;
}
