export const PRESENTATION_CHILDREN = new Set([
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

export const GRAPHIC_FRAME_LIMITATIONS = {
	unknown: ['UNSUPPORTED_GRAPHIC_FRAME', 'The graphic-frame payload is preserved but unsupported.'],
	smartArt: [
		'PARTIAL_SMARTART_SUPPORT',
		'SmartArt is parsed and preserved, but some DiagramML behavior is not editable.',
	],
	ole: ['PARTIAL_OLE_SUPPORT', 'The OLE payload is preserved but cannot be rendered or edited.'],
	ink: [
		'PARTIAL_INK_SUPPORT',
		'Ink is rendered from decoded traces; unsupported ink properties remain raw XML.',
	],
} as const;
