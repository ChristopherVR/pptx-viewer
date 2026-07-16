import type { XmlObject } from './common';

/** The three DiagramML definition-header catalog families. */
export type PptxSmartArtDefinitionHeaderKind = 'layout' | 'style' | 'color';

/** Localized CT_Name/CT_Description value. */
export interface PptxSmartArtHeaderText {
	value: string;
	language?: string;
	/** Original element retained for foreign attribute preservation. */
	rawXml?: XmlObject;
}

/** CT_Category, CT_SDCategory, or CT_CTCategory metadata. */
export interface PptxSmartArtHeaderCategory {
	type: string;
	priority: number;
	/** Original element retained for foreign attribute preservation. */
	rawXml?: XmlObject;
}

/** Typed common model for the three DiagramML definition header types. */
export interface PptxSmartArtDefinitionHeader {
	uniqueId: string;
	minimumVersion?: string;
	/** CT_DiagramDefinitionHeader only. */
	defaultStyle?: string;
	resourceId?: number;
	titles: PptxSmartArtHeaderText[];
	descriptions: PptxSmartArtHeaderText[];
	categories?: PptxSmartArtHeaderCategory[];
	/** Original header retained for extension and foreign markup preservation. */
	rawXml?: XmlObject;
}

/** A layoutDefHdrLst, styleDefHdrLst, or colorsDefHdrLst root. */
export interface PptxSmartArtDefinitionHeaderList {
	kind: PptxSmartArtDefinitionHeaderKind;
	headers: PptxSmartArtDefinitionHeader[];
	/** Original list root retained for namespace and foreign markup preservation. */
	rawXml?: XmlObject;
}

/** OPC metadata for an actual DiagramML definition part. */
export interface PptxSmartArtDefinitionPartDescriptor {
	kind: PptxSmartArtDefinitionHeaderKind;
	contentType: string;
	relationshipType: string;
	rootElement: 'layoutDef' | 'styleDef' | 'colorsDef';
	targetName: 'layout' | 'quickStyle' | 'colors';
}
