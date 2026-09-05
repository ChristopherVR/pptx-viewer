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

export const AddElementSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	type: z.enum(['text', 'shape', 'image', 'table', 'connector']).describe('Element type to add'),
	x: z.number().optional().describe('X position in points'),
	y: z.number().optional().describe('Y position in points'),
	width: z.number().optional().describe('Width in points'),
	height: z.number().optional().describe('Height in points'),
	text: z.string().optional().describe('Text content'),
	fontSize: z.number().optional().describe('Font size in points'),
	fontFamily: z.string().optional().describe('Font family name'),
	fontColor: z.string().optional().describe('Font color (hex)'),
	bold: z.boolean().optional().describe('Bold text'),
	italic: z.boolean().optional().describe('Italic text'),
	underline: z.boolean().optional().describe('Underline text'),
	alignment: z.enum(['left', 'center', 'right', 'justify']).optional().describe('Text alignment'),
	shapeType: z.string().optional().describe('Shape type (e.g. "rect", "ellipse")'),
	fillColor: z.string().optional().describe('Fill color (hex)'),
	strokeColor: z.string().optional().describe('Stroke color (hex)'),
	strokeWidth: z.number().optional().describe('Stroke width in points'),
	imageData: z.string().optional().describe('Image as base64 data URL'),
	altText: z.string().optional().describe('Alt text for accessibility'),
	rows: z.number().int().min(1).optional().describe('Number of table rows'),
	columns: z.number().int().min(1).optional().describe('Number of table columns'),
	cellData: z.array(z.array(z.string())).optional().describe('Table cell data as 2D array'),
	headerRow: z.boolean().optional().describe('Style first row as header'),
	startArrow: z.string().optional().describe('Start arrow type'),
	endArrow: z.string().optional().describe('End arrow type'),
	startShapeId: z.string().optional().describe('Connect start to shape ID'),
	endShapeId: z.string().optional().describe('Connect end to shape ID'),
});

export const UpdateElementSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Element ID to update'),
	x: z.number().optional(),
	y: z.number().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	rotation: z.number().optional(),
	text: z.string().optional(),
	fontSize: z.number().optional(),
	fontFamily: z.string().optional(),
	fontColor: z.string().optional(),
	/**
	 * A theme colour for the run text. Wins on save; resolves `fontColor`
	 * immediately when `fontColor` was not also given. Passing `fontColor`
	 * alone clears a previously-set text theme colour.
	 */
	fontThemeColor: ThemeColorRefSchema.optional(),
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	underline: z.boolean().optional(),
	alignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
	fillColor: z.string().optional(),
	strokeColor: z.string().optional(),
	strokeWidth: z.number().optional(),
	opacity: z.number().min(0).max(1).optional(),
	hidden: z.boolean().optional(),
	flipH: z.boolean().optional(),
	flipV: z.boolean().optional(),
});

export const RenameElementSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Element ID to rename'),
	name: z.string().describe('New element name (empty string clears the name)'),
});

export const DeleteElementsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementIds: z.array(z.string()).min(1).describe('Element IDs to delete'),
});

export const ArrangeElementsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	action: z.enum(['align', 'reorderLayer']),
	elementIds: z.array(z.string()).optional().describe('Element IDs (for align)'),
	alignment: z.enum(['left', 'right', 'top', 'bottom', 'centerH', 'centerV']).optional(),
	elementId: z.string().optional().describe('Element ID (for reorderLayer)'),
	layerAction: z.enum(['bringForward', 'sendBackward', 'bringToFront', 'sendToBack']).optional(),
});

export const CloneElementSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string(),
	targetSlideIndexes: z.array(z.number().int().min(0)).optional(),
	offsetX: z.number().optional(),
	offsetY: z.number().optional(),
});

export const SetElementAnimationSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementId: z.string(),
	entrance: z.string().optional(),
	exit: z.string().optional(),
	durationMs: z.number().optional(),
	delayMs: z.number().optional(),
	order: z.number().optional(),
});

export const GroupElementsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementIds: z.array(z.string()).min(2).describe('At least 2 element IDs to group'),
});

export const UngroupElementsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	groupElementId: z.string().describe('Group element ID to ungroup'),
});

export const BatchUpdateElementsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0),
	elementIds: z.array(z.string()).min(1),
	x: z.number().optional(),
	y: z.number().optional(),
	width: z.number().optional(),
	height: z.number().optional(),
	rotation: z.number().optional(),
	opacity: z.number().min(0).max(1).optional(),
	hidden: z.boolean().optional(),
});
