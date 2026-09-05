import type { PptxData } from '../../core/types';

/**
 * Canonical inventory of the presentation-level fields of {@link PptxData}
 * (everything except `slides`, which the JSON document stores as its own
 * top-level array).
 *
 * Mirrors the pattern of `ELEMENT_FIELD_KIND` / `SLIDE_FIELD_KIND`
 * (`core/types/collaboration-field-schema.ts`): typed as
 * `Record<keyof Omit<PptxData, 'slides'>, true>` so TypeScript forces this
 * list to be updated whenever `PptxData` gains or loses a field, turning
 * "forgot to serialize a new presentation field" into a compile error
 * instead of silent JSON data loss.
 */
export const PRESENTATION_FIELD_KEYS: Record<keyof Omit<PptxData, 'slides'>, true> = {
	width: true,
	height: true,
	widthEmu: true,
	heightEmu: true,
	slideSizeType: true,
	notesWidthEmu: true,
	notesHeightEmu: true,
	layoutOptions: true,
	headerFooter: true,
	presentationProperties: true,
	customShows: true,
	sections: true,
	warnings: true,
	themeColorMap: true,
	theme: true,
	themeOptions: true,
	tableStyleMap: true,
	tableStylesDefaultId: true,
	isPasswordProtected: true,
	embeddedFonts: true,
	embeddedFontList: true,
	mruColors: true,
	notesMaster: true,
	handoutMaster: true,
	slideMasters: true,
	tags: true,
	customProperties: true,
	coreProperties: true,
	appProperties: true,
	hasMacros: true,
	hasDigitalSignatures: true,
	digitalSignatureCount: true,
	presentationGuides: true,
	viewProperties: true,
	modifyVerifier: true,
	photoAlbum: true,
	smartTags: true,
	kinsoku: true,
	customXmlParts: true,
	customerData: true,
	thumbnailData: true,
	commentAuthors: true,
	modernCommentAuthors: true,
	conformance: true,
	embedTrueTypeFonts: true,
	defaultTextStyle: true,
};

/** Ordered list of the presentation-level field names. */
export const PRESENTATION_FIELD_NAMES: ReadonlyArray<string> = Object.keys(PRESENTATION_FIELD_KEYS);
