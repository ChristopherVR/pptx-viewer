import { z } from 'zod';

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
