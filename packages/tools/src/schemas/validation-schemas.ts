import { z } from 'zod';

export const ValidatePresentationSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const RepairPresentationSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});
