import { z } from 'zod';

export const ExportToJsonSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	pretty: z
		.boolean()
		.optional()
		.describe('Pretty-print the JSON document with 2-space indentation (default true)'),
});

export const ImportFromJsonSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	json: z
		.string()
		.describe('The pptx-viewer-json document text to import (replaces the deck content)'),
});
