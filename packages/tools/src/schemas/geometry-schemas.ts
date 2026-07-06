import { z } from 'zod';

export const ReplaceGeometrySchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Shape element ID'),
	shapeType: z
		.string()
		.optional()
		.describe('Preset shape type (e.g. "roundRect", "star5", "ellipse", "diamond")'),
	svgPath: z
		.string()
		.optional()
		.describe('Custom SVG path data (mutually exclusive with shapeType)'),
	pathWidth: z.number().optional().describe('Width of SVG path coordinate space'),
	pathHeight: z.number().optional().describe('Height of SVG path coordinate space'),
	adjustments: z.record(z.string(), z.number()).optional().describe('Shape adjustment values'),
});
