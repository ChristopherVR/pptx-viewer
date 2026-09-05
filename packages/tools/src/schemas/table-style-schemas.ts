import { z } from 'zod';

/**
 * A theme colour reference (the typed counterpart of `<a:schemeClr>`): a
 * scheme slot plus PowerPoint's luminance/tint/shade variants, e.g.
 * `{ scheme: 'accent1', lumMod: 0.6, lumOff: 0.4 }` for "Accent 1, Lighter
 * 40%". Mirrors `PptxThemeColorRef` from `pptx-viewer-core`. Every transform
 * is a 0..1 fraction.
 */
const ThemeColorRefSchema = z.object({
	scheme: z.enum([
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
		'bg1',
		'tx1',
		'bg2',
		'tx2',
		'phClr',
	]),
	lumMod: z.number().optional().describe('Multiply HSL luminance (0..1)'),
	lumOff: z.number().optional().describe('Add to HSL luminance after lumMod (0..1)'),
	tint: z.number().optional().describe('Blend towards white (0..1)'),
	shade: z.number().optional().describe('Blend towards black (0..1)'),
	alpha: z.number().optional().describe('Opacity fraction, 1 = opaque'),
});

export const UpdateTableCellsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string().describe('Table element ID'),
	cells: z
		.array(
			z.object({
				row: z.number().int().min(0),
				col: z.number().int().min(0),
				text: z.string(),
			}),
		)
		.min(1)
		.describe('Cells to update'),
});

export const ManageTableStructureSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string().describe('Table element ID'),
	action: z.enum(['insertRow', 'deleteRow', 'insertColumn', 'deleteColumn']),
	position: z.number().int().min(0).optional().describe('Insertion position index'),
	referenceIndex: z.number().int().min(0).optional(),
	cellTexts: z.array(z.string()).optional(),
});

export const UpdateElementStyleSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string(),
	fillColor: z.string().optional(),
	/**
	 * A theme colour for the fill (e.g. `{ scheme: 'accent1', lumMod: 0.8 }`
	 * for "Accent 1, Lighter 80%"). When set, the shape saves as
	 * `<a:schemeClr>` and keeps following the theme after a later theme
	 * change, instead of freezing today's resolved hex. Setting `fillColor`
	 * without this clears any previously-set fill theme colour.
	 */
	fillThemeColor: ThemeColorRefSchema.optional(),
	fillMode: z.string().optional(),
	fillGradientStops: z
		.array(
			z.object({
				color: z.string(),
				position: z.number(),
				opacity: z.number().optional(),
			}),
		)
		.optional(),
	fillGradientAngle: z.number().optional(),
	fillGradientType: z.string().optional(),
	fillOpacity: z.number().optional(),
	strokeColor: z.string().optional(),
	/** A theme colour for the outline; see `fillThemeColor` above. */
	strokeThemeColor: ThemeColorRefSchema.optional(),
	strokeWidth: z.number().optional(),
	strokeDash: z.string().optional(),
	strokeOpacity: z.number().optional(),
	shadowColor: z.string().optional(),
	shadowBlur: z.number().optional(),
	shadowOffsetX: z.number().optional(),
	shadowOffsetY: z.number().optional(),
	shadowOpacity: z.number().optional(),
	glowColor: z.string().optional(),
	glowRadius: z.number().optional(),
	glowOpacity: z.number().optional(),
	softEdgeRadius: z.number().optional(),
	cropLeft: z.number().optional(),
	cropTop: z.number().optional(),
	cropRight: z.number().optional(),
	cropBottom: z.number().optional(),
	brightness: z.number().optional(),
	contrast: z.number().optional(),
	grayscale: z.boolean().optional(),
	altText: z.string().optional(),
});

// Content tool schemas
export const FindTextSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	query: z.string().describe('Text to search for'),
	useRegex: z.boolean().optional().describe('Treat query as regex'),
	caseSensitive: z.boolean().optional().describe('Case-sensitive search'),
	slideIndexes: z
		.array(z.number().int().min(0))
		.optional()
		.describe('Limit search to specific slides'),
});

export const ReplaceTextSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	query: z.string().describe('Text to find'),
	replacement: z.string().describe('Replacement text'),
	useRegex: z.boolean().optional(),
	caseSensitive: z.boolean().optional(),
	slideIndexes: z.array(z.number().int().min(0)).optional(),
});

export const ManageCommentsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	action: z.enum(['list', 'add', 'delete', 'resolve']),
	slideIndex: z.number().int().min(0).optional(),
	text: z.string().optional(),
	author: z.string().optional(),
	commentId: z.string().optional(),
	resolved: z.boolean().optional(),
	includeResolved: z.boolean().optional(),
});

// ── Table STYLE (ppt/tableStyles.xml) editing (W3-E) ─────────────────────────
// The 13 CT_TableStyle part names (ECMA-376 §21.1.3.14), in the same order
// `pptx-viewer-core`'s TABLE_STYLE_PART_SEQUENCE declares them.
export const TABLE_STYLE_SECTIONS = [
	'wholeTbl',
	'band1H',
	'band2H',
	'band1V',
	'band2V',
	'lastCol',
	'firstCol',
	'lastRow',
	'seCell',
	'swCell',
	'firstRow',
	'neCell',
	'nwCell',
] as const;

const TableStyleSimpleColorSchema = z.object({
	schemeColor: z
		.string()
		.describe('Theme colour key (e.g. "accent1"), or "" for a non-scheme fill'),
	tint: z.number().optional().describe('0-100000'),
	shade: z.number().optional().describe('0-100000'),
	color: z.string().optional().describe('Explicit hex colour, e.g. "#FF8800"'),
});

export const TableStyleFillSchema = z.object({
	schemeColor: z.string(),
	tint: z.number().optional(),
	shade: z.number().optional(),
	color: z.string().optional(),
	noFill: z.boolean().optional(),
	gradient: z
		.object({
			type: z.enum(['linear', 'radial']),
			angle: z.number().optional(),
			stops: z.array(z.object({ position: z.number(), fill: TableStyleSimpleColorSchema })),
		})
		.optional(),
	pattern: z
		.object({
			preset: z.string(),
			foreground: TableStyleSimpleColorSchema.optional(),
			background: TableStyleSimpleColorSchema.optional(),
		})
		.optional(),
	image: z.object({ path: z.string().optional(), data: z.string().optional() }).optional(),
});

export const TableStyleTextSchema = z.object({
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	underline: z.boolean().optional(),
	fontSchemeColor: z.string().optional(),
	fontTint: z.number().optional(),
	fontShade: z.number().optional(),
	fontColor: z.string().optional(),
	fontFace: z.string().optional(),
	fontRefIdx: z.string().optional(),
});

const TableStyleBorderSideSchema = z.object({
	width: z.number().optional(),
	dash: z.string().optional(),
	fill: TableStyleSimpleColorSchema.optional(),
	color: z.string().optional(),
	noFill: z.boolean().optional(),
});

export const TableStyleBordersSchema = z.object({
	left: TableStyleBorderSideSchema.optional(),
	right: TableStyleBorderSideSchema.optional(),
	top: TableStyleBorderSideSchema.optional(),
	bottom: TableStyleBorderSideSchema.optional(),
	insideH: TableStyleBorderSideSchema.optional(),
	insideV: TableStyleBorderSideSchema.optional(),
	tl2br: TableStyleBorderSideSchema.optional(),
	tr2bl: TableStyleBorderSideSchema.optional(),
});

export const TableStyleCell3DSchema = z.object({
	bevelWidth: z.number().optional(),
	bevelHeight: z.number().optional(),
	bevelPreset: z.string().optional(),
	material: z.string().optional(),
	lightRig: z.string().optional(),
	lightRigDirection: z.string().optional(),
});

export const SetTableStyleSectionSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	styleId: z.string().describe('Table style GUID, e.g. "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"'),
	section: z.enum(TABLE_STYLE_SECTIONS).describe('Which of the 13 CT_TableStyle parts to patch'),
	styleName: z.string().optional().describe('Rename the style'),
	fill: TableStyleFillSchema.optional(),
	text: TableStyleTextSchema.optional(),
	borders: TableStyleBordersSchema.optional(),
	cell3D: TableStyleCell3DSchema.optional(),
});

export const CreateTableStyleSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	styleName: z.string().describe('Display name for the new style'),
	basedOnStyleId: z
		.string()
		.optional()
		.describe('Deep-clone every section from this existing style GUID as the starting point'),
	setAsDefault: z
		.boolean()
		.optional()
		.describe("Repoint ppt/tableStyles.xml's default style at the new one"),
});

export const DeleteTableStyleSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	styleId: z.string().describe('Table style GUID to remove'),
	force: z
		.boolean()
		.optional()
		.describe('Delete even though a table on this deck still references the style'),
});

export const AssignTableStyleSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string().describe('Table element ID'),
	styleId: z
		.string()
		.optional()
		.describe(
			"Table style GUID to assign. Defaults to the presentation's current default table style when omitted.",
		),
	bandedRows: z.boolean().optional(),
	bandedColumns: z.boolean().optional(),
	firstRowHeader: z.boolean().optional(),
	lastRow: z.boolean().optional(),
	firstCol: z.boolean().optional(),
	lastCol: z.boolean().optional(),
});
