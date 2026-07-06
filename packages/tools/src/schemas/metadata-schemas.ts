import { z } from 'zod';

export const GetMetadataSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const UpdateMetadataSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	title: z.string().optional().describe('Presentation title'),
	subject: z.string().optional().describe('Subject'),
	creator: z.string().optional().describe('Creator/author name'),
	keywords: z.string().optional().describe('Keywords (comma-separated)'),
	description: z.string().optional().describe('Description/comments'),
	lastModifiedBy: z.string().optional().describe('Last modified by'),
	category: z.string().optional().describe('Category'),
	company: z.string().optional().describe('Company name'),
	manager: z.string().optional().describe('Manager name'),
	customProperties: z
		.array(
			z.object({
				name: z.string(),
				value: z.union([z.string(), z.number(), z.boolean()]),
			}),
		)
		.optional()
		.describe('Custom properties to set'),
});
