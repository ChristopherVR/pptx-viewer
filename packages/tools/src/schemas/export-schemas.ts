import { z } from 'zod';

export const ExportToSvgSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndices: z
		.array(z.number().int().min(0))
		.optional()
		.describe('Specific slides to export (all if omitted)'),
	includeHidden: z.boolean().optional().describe('Include hidden slides'),
	defaultFontFamily: z.string().optional().describe('Default font family for SVG'),
	defaultFontSize: z.number().optional().describe('Default font size'),
});

export const ExportSlideSvgSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index to export'),
	defaultFontFamily: z.string().optional().describe('Default font family for SVG'),
	defaultFontSize: z.number().optional().describe('Default font size'),
});
