import { z } from 'zod';

const PointSchema = z.object({ x: z.number(), y: z.number() });
const ExtentSchema = z.object({ cx: z.number(), cy: z.number() });

const ChartUserShapeInputSchema = z.object({
	kind: z
		.enum(['sp', 'cxnSp'])
		.optional()
		.describe('Overlay shape kind: "sp" (text/preset shape, default) or "cxnSp" (connector).'),
	anchor: z
		.enum(['rel', 'abs'])
		.optional()
		.describe(
			'Anchor kind: "rel" (default, resizes with the chart; needs `to`) or "abs" (fixed EMU size; needs `ext`).',
		),
	from: PointSchema.describe('Top-left corner as chart-relative fractions (0-1 each).'),
	to: PointSchema.optional().describe(
		'Bottom-right corner as chart-relative fractions; rel anchors only.',
	),
	ext: ExtentSchema.optional().describe('Width/height in EMU; abs anchors only.'),
	prst: z
		.string()
		.optional()
		.describe('Preset geometry name (e.g. "rect", "roundRect"); default "rect".'),
	fill: z.string().optional().describe('Solid fill colour, hex (e.g. "#FFFF00").'),
	stroke: z.string().optional().describe('Line colour, hex.'),
	strokeWidth: z.number().optional().describe('Line width in points.'),
	text: z.string().optional().describe('Plain text content, centred in the shape.'),
});

export const ListChartUserShapesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
});

export const AddChartUserShapeSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	shape: ChartUserShapeInputSchema.describe('The overlay shape to add.'),
});

export const UpdateChartUserShapeSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	index: z
		.number()
		.int()
		.min(0)
		.describe('Zero-based overlay-shape index (from chart_user_shape_list)'),
	patch: ChartUserShapeInputSchema.partial().describe(
		'Fields to overwrite; anything omitted is left as-is.',
	),
});

export const RemoveChartUserShapeSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Chart element ID'),
	index: z.number().int().min(0).describe('Zero-based overlay-shape index to remove'),
});
