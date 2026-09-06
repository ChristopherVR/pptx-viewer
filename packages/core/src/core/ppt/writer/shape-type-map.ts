/**
 * ECMA-376 preset geometry name -> MSOSPT (OfficeArt shape type) mapping,
 * the inverse of `escher/geometry-map.ts`'s read-side `presetForShapeType`.
 *
 * @module ppt/writer/shape-type-map
 */

const NAME_TO_SPT: ReadonlyMap<string, number> = new Map([
	['rect', 1],
	['roundRect', 2],
	['ellipse', 3],
	['diamond', 4],
	['triangle', 5],
	['rtTriangle', 6],
	['parallelogram', 7],
	['trapezoid', 8],
	['hexagon', 9],
	['octagon', 10],
	['plus', 11],
	['star5', 12],
	['rightArrow', 13],
	['homePlate', 15],
	['cube', 16],
	['arc', 19],
	['line', 20],
	['plaque', 21],
	['can', 22],
	['donut', 23],
	['callout1', 41],
	['callout2', 42],
	['callout3', 43],
	['accentCallout1', 44],
	['ribbon', 53],
	['ribbon2', 54],
	['chevron', 55],
	['pentagon', 56],
	['noSmoking', 57],
	['star8', 58],
	['star16', 59],
	['star32', 60],
	['wedgeRectCallout', 61],
	['wedgeRoundRectCallout', 62],
	['wedgeEllipseCallout', 63],
	['wave', 64],
	['foldedCorner', 65],
	['leftArrow', 66],
	['downArrow', 67],
	['upArrow', 68],
	['leftRightArrow', 69],
	['upDownArrow', 70],
	['irregularSeal1', 71],
	['irregularSeal2', 72],
	['lightningBolt', 73],
	['heart', 74],
	['quadArrow', 76],
	['leftArrowCallout', 77],
	['rightArrowCallout', 78],
	['upArrowCallout', 79],
	['downArrowCallout', 80],
	['leftRightArrowCallout', 81],
	['upDownArrowCallout', 82],
	['quadArrowCallout', 83],
	['bevel', 84],
	['leftBracket', 85],
	['rightBracket', 86],
	['leftBrace', 87],
	['rightBrace', 88],
	['star24', 92],
	['smileyFace', 96],
	['verticalScroll', 97],
	['horizontalScroll', 98],
	['circularArrow', 99],
	['cloudCallout', 106],
	['flowChartProcess', 109],
	['flowChartDecision', 110],
	['flowChartInputOutput', 111],
	['flowChartPredefinedProcess', 112],
	['flowChartInternalStorage', 113],
	['flowChartDocument', 114],
	['flowChartMultidocument', 115],
	['flowChartTerminator', 116],
	['flowChartPreparation', 117],
	['flowChartManualInput', 118],
	['flowChartManualOperation', 119],
	['flowChartConnector', 120],
	['flowChartPunchedCard', 121],
	['flowChartPunchedTape', 122],
	['flowChartSummingJunction', 123],
	['flowChartOr', 124],
	['flowChartCollate', 125],
	['flowChartSort', 126],
	['flowChartExtract', 127],
	['flowChartMerge', 128],
	['flowChartOnlineStorage', 130],
	['flowChartMagneticTape', 131],
	['flowChartMagneticDisk', 132],
	['flowChartMagneticDrum', 133],
	['flowChartDisplay', 134],
	['flowChartDelay', 135],
	['flowChartAlternateProcess', 176],
	['flowChartOffpageConnector', 177],
	['leftRightUpArrow', 182],
	['sun', 183],
	['moon', 184],
	['bracketPair', 185],
	['bracePair', 186],
	['star4', 187],
	['doubleWave', 188],
	['straightConnector1', 32],
	['bentConnector2', 33],
	['bentConnector3', 34],
	['bentConnector4', 35],
	['bentConnector5', 36],
	['curvedConnector2', 37],
	['curvedConnector3', 38],
	['curvedConnector4', 39],
	['curvedConnector5', 40],
]);

/** MSOSPT for a plain text box (no autoshape geometry). */
export const TEXT_BOX_SPT = 202;

/**
 * Aliases the way `getShapeType`/`presetForShapeType` fold at the read side:
 * `oval` -> `ellipse`, `can` -> `cylinder` (mapped here to `can`, this
 * table's own key for MSOSPT 22). Comparing the RAW preset string (as one
 * binding once did, see CLAUDE.md) misses both.
 */
const ALIASES: Readonly<Record<string, string>> = {
	oval: 'ellipse',
	cylinder: 'can',
};

/**
 * Map an ECMA-376 preset geometry name (or "textBox") to an MSOSPT value.
 * Unknown presets fall back to a plain rectangle.
 */
export function sptForPreset(preset: string | undefined, isTextBox: boolean): number {
	if (isTextBox) {
		return TEXT_BOX_SPT;
	}
	if (!preset) {
		return 1;
	}
	const normalized = preset.trim();
	const aliased = ALIASES[normalized] ?? normalized;
	return NAME_TO_SPT.get(aliased) ?? 1;
}
