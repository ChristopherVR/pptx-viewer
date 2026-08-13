/**
 * The closed `ST_ShapeType` enumeration and the alias table that folds this
 * repository's internal / UI-facing shape identifiers onto it.
 *
 * `a:prstGeom/@prst` is typed `ST_ShapeType` (ISO/IEC 29500-1 section
 * 20.1.10.55 / A.4.1), a **closed 187-value enumeration**. Emitting anything
 * else produces a package PowerPoint rejects at schema-validation time, so
 * every writer that fills `@prst` must pass its identifier through
 * {@link normalizeStShapeType} first.
 *
 * Two families of non-spec identifier exist in this codebase and both are
 * resolved here rather than at the call sites:
 *
 *  - **UI / legacy aliases** the shape picker and the shared insert catalogue
 *    offer under friendlier names (`rightTriangle`, `cross`, `flowChartData`,
 *    ...). Each maps to the real preset it draws.
 *  - **Internal `SupportedShapeType` tokens** (`cylinder`, `rtArrow`,
 *    `connector`) which are render-layer classifications, not OOXML names.
 *
 * Lookup is exact-match first (deck-authored values are already canonical),
 * then case-insensitive, then the alias table. Unknown identifiers resolve to
 * `undefined` so the caller can substitute a safe default instead of writing
 * an invalid token.
 */

/**
 * The canonical `ST_ShapeType` enumeration, in ISO/IEC 29500-1 declaration
 * order. Exactly 187 values.
 */
export const ST_SHAPE_TYPE_VALUES: readonly string[] = [
	'line',
	'lineInv',
	'triangle',
	'rtTriangle',
	'rect',
	'diamond',
	'parallelogram',
	'trapezoid',
	'nonIsoscelesTrapezoid',
	'pentagon',
	'hexagon',
	'heptagon',
	'octagon',
	'decagon',
	'dodecagon',
	'star4',
	'star5',
	'star6',
	'star7',
	'star8',
	'star10',
	'star12',
	'star16',
	'star24',
	'star32',
	'roundRect',
	'round1Rect',
	'round2SameRect',
	'round2DiagRect',
	'snipRoundRect',
	'snip1Rect',
	'snip2SameRect',
	'snip2DiagRect',
	'plaque',
	'ellipse',
	'teardrop',
	'homePlate',
	'chevron',
	'pieWedge',
	'pie',
	'blockArc',
	'donut',
	'noSmoking',
	'rightArrow',
	'leftArrow',
	'upArrow',
	'downArrow',
	'stripedRightArrow',
	'notchedRightArrow',
	'bentUpArrow',
	'leftRightArrow',
	'upDownArrow',
	'leftUpArrow',
	'leftRightUpArrow',
	'quadArrow',
	'leftArrowCallout',
	'rightArrowCallout',
	'upArrowCallout',
	'downArrowCallout',
	'leftRightArrowCallout',
	'upDownArrowCallout',
	'quadArrowCallout',
	'bentArrow',
	'uturnArrow',
	'circularArrow',
	'leftCircularArrow',
	'leftRightCircularArrow',
	'curvedRightArrow',
	'curvedLeftArrow',
	'curvedUpArrow',
	'curvedDownArrow',
	'swooshArrow',
	'cube',
	'can',
	'lightningBolt',
	'heart',
	'sun',
	'moon',
	'smileyFace',
	'irregularSeal1',
	'irregularSeal2',
	'foldedCorner',
	'bevel',
	'frame',
	'halfFrame',
	'corner',
	'diagStripe',
	'chord',
	'arc',
	'leftBracket',
	'rightBracket',
	'leftBrace',
	'rightBrace',
	'bracketPair',
	'bracePair',
	'straightConnector1',
	'bentConnector2',
	'bentConnector3',
	'bentConnector4',
	'bentConnector5',
	'curvedConnector2',
	'curvedConnector3',
	'curvedConnector4',
	'curvedConnector5',
	'callout1',
	'callout2',
	'callout3',
	'accentCallout1',
	'accentCallout2',
	'accentCallout3',
	'borderCallout1',
	'borderCallout2',
	'borderCallout3',
	'accentBorderCallout1',
	'accentBorderCallout2',
	'accentBorderCallout3',
	'wedgeRectCallout',
	'wedgeRoundRectCallout',
	'wedgeEllipseCallout',
	'cloudCallout',
	'cloud',
	'ribbon',
	'ribbon2',
	'ellipseRibbon',
	'ellipseRibbon2',
	'leftRightRibbon',
	'verticalScroll',
	'horizontalScroll',
	'wave',
	'doubleWave',
	'plus',
	'flowChartProcess',
	'flowChartDecision',
	'flowChartInputOutput',
	'flowChartPredefinedProcess',
	'flowChartInternalStorage',
	'flowChartDocument',
	'flowChartMultidocument',
	'flowChartTerminator',
	'flowChartPreparation',
	'flowChartManualInput',
	'flowChartManualOperation',
	'flowChartConnector',
	'flowChartPunchedCard',
	'flowChartPunchedTape',
	'flowChartSummingJunction',
	'flowChartOr',
	'flowChartCollate',
	'flowChartSort',
	'flowChartExtract',
	'flowChartMerge',
	'flowChartOfflineStorage',
	'flowChartOnlineStorage',
	'flowChartMagneticTape',
	'flowChartMagneticDisk',
	'flowChartMagneticDrum',
	'flowChartDisplay',
	'flowChartDelay',
	'flowChartAlternateProcess',
	'flowChartOffpageConnector',
	'actionButtonBlank',
	'actionButtonHome',
	'actionButtonHelp',
	'actionButtonInformation',
	'actionButtonForwardNext',
	'actionButtonBackPrevious',
	'actionButtonEnd',
	'actionButtonBeginning',
	'actionButtonReturn',
	'actionButtonDocument',
	'actionButtonSound',
	'actionButtonMovie',
	'gear6',
	'gear9',
	'funnel',
	'mathPlus',
	'mathMinus',
	'mathMultiply',
	'mathDivide',
	'mathEqual',
	'mathNotEqual',
	'cornerTabs',
	'squareTabs',
	'plaqueTabs',
	'chartX',
	'chartStar',
	'chartPlus',
];

/**
 * Non-spec identifier (lower-cased) to the `ST_ShapeType` value it draws.
 *
 * Every entry is a shape this repository can produce but OOXML cannot name:
 * UI labels from the shape picker, PowerPoint UI names that differ from the
 * schema name, and internal `SupportedShapeType` render classifications.
 */
export const PRESET_GEOMETRY_ALIASES: Readonly<Record<string, string>> = {
	// Internal SupportedShapeType tokens (render classifications, not OOXML).
	cylinder: 'can',
	rtarrow: 'rightArrow',
	connector: 'straightConnector1',
	// Shape-picker labels that are not the schema name.
	righttriangle: 'rtTriangle',
	cross: 'plus',
	oval: 'ellipse',
	// PowerPoint UI flowchart names vs. their ECMA-376 schema names.
	flowchartdata: 'flowChartInputOutput',
	flowchartdirectdata: 'flowChartMagneticDrum',
	flowchartsequentialaccessstorage: 'flowChartMagneticTape',
	flowchartstoreddata: 'flowChartOnlineStorage',
	// Action buttons: the picker spells out "Or", the schema does not.
	actionbuttonbackorprevious: 'actionButtonBackPrevious',
	actionbuttonforwardornext: 'actionButtonForwardNext',
	// Geometry-table entries invented by earlier batches with no ECMA
	// equivalent. Each is mapped to the real preset it actually draws so a save
	// can never emit the invented name: `pentArrow` is `notchedRightArrow` with
	// a deeper tail notch, the two `*ArrowCallout`s are the polygonal
	// `bentArrow` / `bentUpArrow` silhouettes, and `diamondTabs` is a `diamond`
	// with decorative tabs. `mathFunction` has no honest equivalent and is
	// deliberately absent, so it degrades to `rect` on save.
	pentarrow: 'notchedRightArrow',
	bentarrowcallout: 'bentArrow',
	bentuparrowcallout: 'bentUpArrow',
	diamondtabs: 'diamond',
};

/** Case-insensitive index of the canonical enumeration. */
const CANONICAL_BY_LOWER: ReadonlyMap<string, string> = new Map(
	ST_SHAPE_TYPE_VALUES.map((name) => [name.toLowerCase(), name]),
);

const CANONICAL_SET: ReadonlySet<string> = new Set(ST_SHAPE_TYPE_VALUES);

/**
 * Whether `name` is one of the 187 `ST_ShapeType` values, spelled exactly as
 * the schema declares it.
 */
export function isStShapeType(name: string | undefined): boolean {
	return name !== undefined && CANONICAL_SET.has(name);
}

/**
 * Resolve any shape identifier this codebase can produce to the exact
 * `ST_ShapeType` spelling that belongs in `a:prstGeom/@prst`.
 *
 * @param name - A preset name, picker label, or internal shape token.
 * @returns The canonical `ST_ShapeType` value, or `undefined` when the
 *          identifier is not a preset at all (callers should fall back to a
 *          safe default such as `'rect'` rather than writing it out).
 */
export function normalizeStShapeType(name: string | undefined): string | undefined {
	if (!name) {
		return undefined;
	}
	const trimmed = name.trim();
	if (CANONICAL_SET.has(trimmed)) {
		return trimmed;
	}
	const lower = trimmed.toLowerCase();
	return CANONICAL_BY_LOWER.get(lower) ?? PRESET_GEOMETRY_ALIASES[lower];
}
