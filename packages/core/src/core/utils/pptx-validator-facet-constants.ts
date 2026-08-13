/**
 * Colour-transform percentage facets, per ECMA-376 Part 1 `EG_ColorTransform`
 * (§20.1.2.3.x) and the simple types in §20.1.10.
 *
 * The three sets below are NOT interchangeable, and getting them wrong makes
 * the validator reject genuine PowerPoint output. Only the members of
 * {@link POSITIVE_PERCENT} are capped at 100000; the members of
 * {@link UNBOUNDED_PERCENT} are `CT_Percentage`, whose `ST_Percentage` value
 * space is the full signed integer range. PowerPoint's own default Office
 * theme emits `<a:satMod val="300000"/>` (300 percent) in its gradient fills
 * and `<a:lumMod val="110000"/>` in its chart styles, so capping those at
 * 100000 fails every real deck: it fired 695 times across 32 of the 37
 * readable fixtures in this repo, including all five PowerPoint-COM-authored
 * corpus decks.
 */

/** `CT_PositiveFixedPercentage`: 0 through 100000 inclusive. */
export const POSITIVE_PERCENT = new Set(['alpha', 'tint', 'shade']);

/** `CT_FixedPercentage`: -100000 through 100000 inclusive. */
export const FIXED_PERCENT = new Set(['alphaOff']);

/**
 * `CT_PositivePercentage`: 0 through the `xsd:int` maximum. A modulation is a
 * multiplier, so values above 100 percent are ordinary and expected.
 */
export const POSITIVE_UNBOUNDED_PERCENT = new Set(['alphaMod', 'hueMod']);

/**
 * `CT_Percentage`: the full signed `xsd:int` range. Every saturation,
 * luminance and per-channel transform lives here.
 */
export const UNBOUNDED_PERCENT = new Set([
	'sat',
	'satOff',
	'satMod',
	'lum',
	'lumOff',
	'lumMod',
	'red',
	'redOff',
	'redMod',
	'green',
	'greenOff',
	'greenMod',
	'blue',
	'blueOff',
	'blueMod',
]);

/**
 * The 12 colour-map alias attributes carried by `p:clrMap` (§19.3.1.6) and
 * `a:overrideClrMapping` (§20.1.6.13), each valued with an
 * `ST_ColorSchemeIndex` token (§20.1.10.14).
 *
 * Worth checking, and cheap: PowerPoint rejects the WHOLE PACKAGE with
 * `0x80070570` ("the file or directory is corrupted and unreadable") for a
 * single bad token here. Eleven of the twelve legal tokens are already
 * lower-case, so a stray `.toLowerCase()` anywhere in the pipeline is
 * invisible on all of them and fatal on `folHlink`, the one camel-cased
 * member. That is exactly the defect the COM acceptance pass found on
 * `descender-clip.pptx` and `shape-3d-compound.pptx`.
 */
const COLOR_MAP_ALIASES = [
	'bg1',
	'tx1',
	'bg2',
	'tx2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
] as const;

/** `ST_ColorSchemeIndex`: the theme slots a colour-map alias may point at. */
const COLOR_SCHEME_INDEX = [
	'dk1',
	'lt1',
	'dk2',
	'lt2',
	'accent1',
	'accent2',
	'accent3',
	'accent4',
	'accent5',
	'accent6',
	'hlink',
	'folHlink',
] as const;

function colorMapEnums(): Record<string, readonly string[]> {
	const entries: Record<string, readonly string[]> = {};
	for (const element of ['clrMap', 'overrideClrMapping']) {
		for (const alias of COLOR_MAP_ALIASES) {
			entries[`${element}@${alias}`] = COLOR_SCHEME_INDEX;
		}
	}
	return entries;
}

export const ENUMS: Record<string, readonly string[]> = {
	'ph@type': [
		'title',
		'body',
		'ctrTitle',
		'subTitle',
		'dt',
		'sldNum',
		'ftr',
		'hdr',
		'obj',
		'chart',
		'tbl',
		'clipArt',
		'dgm',
		'media',
		'sldImg',
		'pic',
	],
	'sldLayout@type': [
		'title',
		'tx',
		'twoColTx',
		'tbl',
		'txAndChart',
		'chartAndTx',
		'dgm',
		'chart',
		'txAndClipArt',
		'clipArtAndTx',
		'titleOnly',
		'blank',
		'txAndObj',
		'objAndTx',
		'objOnly',
		'obj',
		'txAndMedia',
		'mediaAndTx',
		'objOverTx',
		'txOverObj',
		'txAndTwoObj',
		'twoObjAndTx',
		'twoObjOverTx',
		'fourObj',
		'vertTx',
		'clipArtAndVertTx',
		'vertTitleAndTx',
		'vertTitleAndTxOverChart',
		'twoObj',
		'objAndTwoObj',
		'twoObjAndObj',
		'cust',
		'secHead',
		'twoTxTwoObj',
		'objTx',
		'picTx',
	],
	'pPr@algn': ['l', 'ctr', 'r', 'just', 'justLow', 'dist', 'thaiDist'],
	'bodyPr@anchor': ['t', 'ctr', 'b', 'just', 'dist'],
	'schemeClr@val': [
		'bg1',
		'tx1',
		'bg2',
		'tx2',
		'accent1',
		'accent2',
		'accent3',
		'accent4',
		'accent5',
		'accent6',
		'hlink',
		'folHlink',
		'phClr',
		'dk1',
		'lt1',
		'dk2',
		'lt2',
	],
	'ln@cap': ['rnd', 'sq', 'flat'],
	'ln@cmpd': ['sng', 'dbl', 'thickThin', 'thinThick', 'tri'],
	'prstDash@val': [
		'solid',
		'dot',
		'dash',
		'lgDash',
		'dashDot',
		'lgDashDot',
		'lgDashDotDot',
		'sysDash',
		'sysDot',
		'sysDashDot',
		'sysDashDotDot',
	],
	...colorMapEnums(),
};

export const BLACK_WHITE = [
	'clr',
	'auto',
	'gray',
	'ltGray',
	'invGray',
	'grayWhite',
	'blackGray',
	'blackWhite',
	'black',
	'white',
	'hidden',
];
