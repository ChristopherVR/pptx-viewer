import { z } from 'zod';

export const FindPlaceholdersSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const ApplyTemplateSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	data: z
		.record(z.string(), z.unknown())
		.describe('Template data: keys are placeholder names, values are replacement values'),
});
