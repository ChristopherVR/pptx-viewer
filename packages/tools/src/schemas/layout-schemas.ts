import { z } from 'zod';

export const GetLayoutsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const ApplyLayoutSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	layoutName: z.string().optional().describe('Layout name to apply'),
	layoutType: z.string().optional().describe('Layout type to apply (alternative to name)'),
});
