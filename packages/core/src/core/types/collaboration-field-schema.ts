/**
 * Canonical field-name inventory for `PptxElement`/`PptxSlide`, used by the
 * real-time collaboration CRDT codecs (`pptx-viewer-shared`'s
 * `collaboration-sync.ts` and `pptx-viewer-mcp`'s `pptx-codec.ts`) to keep
 * their field allowlists complete.
 *
 * Both codecs use different wire-format key prefixes (short `_ts` vs long
 * `_textStyle`) and are NOT interchangeable on the same Y.Doc, but they must
 * cover the same set of fields or one silently drops data the other
 * preserves. `ELEMENT_FIELD_KIND`/`SLIDE_FIELD_KIND` are typed as
 * `Record<AllKeys, CollabFieldKind>`, so TypeScript forces this file to be
 * updated whenever a field is added to any `PptxElement` variant or
 * `PptxSlide` - each codec's own test suite then asserts its allowlists
 * match this inventory exactly, turning "forgot to wire up a new field" into
 * a CI failure instead of a silent collaboration data-loss bug.
 *
 * @module pptx-types/collaboration-field-schema
 */

import type { PptxElement } from './elements';
import type { PptxSlide } from './presentation';

/** Union of every key present on any `PptxElement` variant (not just the common base). */
type AnyElementKey = PptxElement extends infer E ? (E extends object ? keyof E : never) : never;

/**
 * How a codec should carry a field across the wire:
 *  - `scalar`: primitive-ish value written/read as-is (`ymap.set(key, value)`).
 *  - `complex`: structured value serialized as a JSON-string blob.
 *  - `asset`: binary/base64 payload that a live-collaboration transport
 *    should route through a separate asset map instead of embedding inline
 *    (see `pptx-viewer-shared`'s `collaboration-assets.ts`); a full-file
 *    codec like `pptx-codec.ts` may still embed it as a JSON blob.
 *  - `text`: rich text handled via a dedicated `Y.Text`/delta codec, not the
 *    scalar/complex JSON path.
 *  - `nested`: a nested collection (e.g. a slide's `elements`) built as its
 *    own Y.Array of Y.Maps via the same codec, not a JSON blob.
 */
export type CollabFieldKind = 'scalar' | 'complex' | 'asset' | 'text' | 'nested';

export const ELEMENT_FIELD_KIND: Record<AnyElementKey, CollabFieldKind> = {
	// PptxElementBase
	id: 'scalar',
	shapeId: 'scalar',
	name: 'scalar',
	x: 'scalar',
	y: 'scalar',
	width: 'scalar',
	height: 'scalar',
	rotation: 'scalar',
	skewX: 'scalar',
	skewY: 'scalar',
	flipHorizontal: 'scalar',
	flipVertical: 'scalar',
	hidden: 'scalar',
	opacity: 'scalar',
	rawXml: 'complex',
	actionClick: 'complex',
	actionHover: 'complex',
	locks: 'complex',
	extLstXml: 'complex',
	// discriminant
	type: 'scalar',
	// PptxTextProperties
	text: 'scalar',
	textStyle: 'complex',
	textSegments: 'text',
	paragraphIndents: 'complex',
	promptText: 'scalar',
	linkedTxbxId: 'scalar',
	linkedTxbxSeq: 'scalar',
	// PptxShapeProperties
	shapeStyle: 'complex',
	shapeType: 'scalar',
	shapeAdjustments: 'complex',
	adjustmentHandles: 'complex',
	// PptxCustomPathProperties
	pathData: 'scalar',
	pathWidth: 'scalar',
	pathHeight: 'scalar',
	customGeometryPaths: 'complex',
	customGeometryRawData: 'complex',
	customGeometryAdjustHandlesXY: 'complex',
	customGeometryAdjustHandlesPolar: 'complex',
	customGeometryConnectionSites: 'complex',
	customGeometryTextRect: 'complex',
	// PptxImageProperties
	imageData: 'scalar',
	imagePath: 'scalar',
	svgData: 'scalar',
	svgPath: 'scalar',
	altText: 'scalar',
	cropLeft: 'scalar',
	cropTop: 'scalar',
	cropRight: 'scalar',
	cropBottom: 'scalar',
	tileOffsetX: 'scalar',
	tileOffsetY: 'scalar',
	tileScaleX: 'scalar',
	tileScaleY: 'scalar',
	tileFlip: 'scalar',
	tileAlignment: 'scalar',
	imageEffects: 'complex',
	cropShape: 'complex',
	// TablePptxElement / ChartPptxElement / SmartArtPptxElement
	tableData: 'complex',
	chartData: 'complex',
	smartArtData: 'complex',
	extensionXml: 'complex',
	// OlePptxElement
	oleTarget: 'scalar',
	oleProgId: 'scalar',
	oleName: 'scalar',
	oleClsId: 'scalar',
	oleObjectType: 'scalar',
	oleFileExtension: 'scalar',
	fileName: 'scalar',
	isLinked: 'scalar',
	externalPath: 'scalar',
	previewImage: 'scalar',
	previewImageData: 'asset',
	oleShowAsIcon: 'scalar',
	oleImgW: 'scalar',
	oleImgH: 'scalar',
	oleEmbeddedData: 'asset',
	oleEmbeddedFileName: 'scalar',
	oleEmbeddedMimeType: 'scalar',
	oleEmbeddedByteSize: 'scalar',
	// MediaPptxElement
	mediaType: 'scalar',
	mediaPath: 'scalar',
	mediaData: 'asset',
	mediaMimeType: 'scalar',
	mediaReferenceKind: 'scalar',
	mediaReferenceName: 'scalar',
	mediaReferenceContentType: 'scalar',
	audioCdStart: 'complex',
	audioCdEnd: 'complex',
	rawMediaReferenceXml: 'complex',
	trimStartMs: 'scalar',
	trimEndMs: 'scalar',
	posterFramePath: 'scalar',
	posterFrameData: 'asset',
	fullScreen: 'scalar',
	loop: 'scalar',
	fadeInDuration: 'scalar',
	fadeOutDuration: 'scalar',
	volume: 'scalar',
	autoPlay: 'scalar',
	playAcrossSlides: 'scalar',
	hideWhenNotPlaying: 'scalar',
	bookmarks: 'complex',
	playbackSpeed: 'scalar',
	metadata: 'complex',
	captionTracks: 'complex',
	mediaMissing: 'scalar',
	// GroupPptxElement
	children: 'complex',
	groupFill: 'complex',
	// InkPptxElement
	inkPaths: 'scalar',
	inkColors: 'scalar',
	inkWidths: 'scalar',
	inkOpacities: 'scalar',
	inkTool: 'scalar',
	inkPointPressures: 'complex',
	// ContentPartPptxElement
	inkStrokes: 'complex',
	inkPartPath: 'scalar',
	inkPartRawXml: 'complex',
	// ZoomPptxElement
	zoomType: 'scalar',
	targetSlideIndex: 'scalar',
	targetSectionId: 'scalar',
	summaryTargets: 'complex',
	summaryLayout: 'scalar',
	// Model3DPptxElement
	modelPath: 'scalar',
	modelData: 'asset',
	modelMimeType: 'scalar',
	posterImage: 'scalar',
};

export const SLIDE_FIELD_KIND: Record<keyof PptxSlide, CollabFieldKind> = {
	id: 'scalar',
	rId: 'scalar',
	sourceSlideId: 'scalar',
	name: 'scalar',
	layoutPath: 'scalar',
	layoutName: 'scalar',
	slideNumber: 'scalar',
	hidden: 'scalar',
	sectionName: 'scalar',
	sectionId: 'scalar',
	elements: 'nested',
	backgroundColor: 'scalar',
	backgroundImage: 'scalar',
	backgroundGradient: 'scalar',
	backgroundPattern: 'complex',
	backgroundShadeToTitle: 'scalar',
	transition: 'complex',
	animations: 'complex',
	nativeAnimations: 'complex',
	rawTiming: 'complex',
	notes: 'scalar',
	notesSegments: 'complex',
	notesShapes: 'complex',
	notesClrMapOverride: 'complex',
	notesCSldName: 'scalar',
	comments: 'complex',
	modernCommentPart: 'complex',
	warnings: 'complex',
	rawXml: 'complex',
	clrMapOverride: 'complex',
	backgroundShowAnimation: 'scalar',
	showMasterShapes: 'scalar',
	guides: 'complex',
	isDirty: 'scalar',
	customerData: 'complex',
	activeXControls: 'complex',
	legacyVmlElements: 'complex',
	headerFooterFlags: 'complex',
	slideSynchronization: 'complex',
};
