/**
 * The Markup Compatibility envelope is NOT unmodelled markup.
 *
 * PowerPoint wraps anything from a later schema in `mc:AlternateContent` - on a
 * slide that is every 2010+ transition, morph included, and 2010+ timing - and
 * the reader resolves both out of it (`slide-transition-envelope`). Leaving it
 * out of these sets made every such slide report `UNMODELLED_SLIDE_MARKUP` for
 * markup we do expose: a 14-slide deck logged 14 warnings per load for its own
 * morph transitions. A choice we genuinely cannot honour still reports, through
 * `inspectAlternateContentWarnings`, as `UNSUPPORTED_ALTERNATE_CONTENT_CHOICE`
 * - which names the failing `Requires` token instead of the envelope.
 */
const MARKUP_COMPATIBILITY_ENVELOPE = 'mc:AlternateContent';

export const PRESENTATION_CHILDREN = new Set([
	MARKUP_COMPATIBILITY_ENVELOPE,
	'p:sldMasterIdLst',
	'p:notesMasterIdLst',
	'p:handoutMasterIdLst',
	'p:sldIdLst',
	'p:sldSz',
	'p:notesSz',
	'p:smartTags',
	'p:embeddedFontLst',
	'p:custShowLst',
	'p:photoAlbum',
	'p:custDataLst',
	'p:kinsoku',
	'p:defaultTextStyle',
	'p:modifyVerifier',
	'p:extLst',
]);

export const SLIDE_CHILDREN = new Set([
	MARKUP_COMPATIBILITY_ENVELOPE,
	'p:cSld',
	'p:clrMapOvr',
	'p:transition',
	'p:timing',
	'p:extLst',
]);
export const SHAPE_PROPERTY_CHILDREN = new Set([
	'a:xfrm',
	'a:prstGeom',
	'a:custGeom',
	'a:noFill',
	'a:solidFill',
	'a:gradFill',
	'a:blipFill',
	'a:pattFill',
	'a:grpFill',
	'a:ln',
	'a:effectLst',
	'a:effectDag',
	'a:scene3d',
	'a:sp3d',
	'a:extLst',
]);
export const TEXT_BODY_CHILDREN = new Set(['a:bodyPr', 'a:lstStyle', 'a:p']);
export const BLIP_FILL_CHILDREN = new Set(['a:blip', 'a:srcRect', 'a:tile', 'a:stretch']);
export const BLIP_CHILDREN = new Set([
	'a:alphaBiLevel',
	'a:alphaCeiling',
	'a:alphaFloor',
	'a:alphaInv',
	'a:alphaMod',
	'a:alphaModFix',
	'a:alphaRepl',
	'a:biLevel',
	'a:blur',
	'a:clrChange',
	'a:clrRepl',
	'a:duotone',
	'a:fillOverlay',
	'a:grayscl',
	'a:hsl',
	'a:lum',
	'a:tint',
	'a:extLst',
]);

// SmartArt intentionally has NO entry here: parsing, rendering (via the shared
// layout interpreter), editing of nodes/text/layout/colours, lossless ptLst
// round-trip, insertable presets and 3D are all fully supported, so warning on
// every load was actively misleading (the "not editable" claim was false). The
// one genuine nuance, decks saved without a cached `dsp:drawing` are laid out
// by the interpreter rather than replayed from PowerPoint's own cached shapes,
// is a documented approximation (measured against 229 COM-authored gallery
// fixtures: 227 produce PowerPoint's exact set of shapes, 39 match its geometry
// within 1%; see docs/architecture/openxml-conformance.md#smartart-layout-ground-truth).
// Decks PowerPoint saved always carry the cache, so this is a layout-fidelity
// gap rather than an unsupported feature, and it does not belong in this
// per-load compatibility toast.
export const GRAPHIC_FRAME_LIMITATIONS = {
	unknown: ['UNSUPPORTED_GRAPHIC_FRAME', 'The graphic-frame payload is preserved but unsupported.'],
	ole: [
		'PARTIAL_OLE_SUPPORT',
		'The OLE payload renders as a preview image and can be downloaded or opened in a new tab. Excel, Word, and PowerPoint objects (xlsx, xls, docx, doc, and nested .pptx decks) can also be edited in place; other embedded file types are download/replace-only.',
	],
	ink: [
		'PARTIAL_INK_SUPPORT',
		'Ink is rendered from decoded traces; unsupported ink properties remain raw XML.',
	],
} as const;
