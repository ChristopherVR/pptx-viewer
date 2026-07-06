import { z } from 'zod';

export const GetPresentationPropertiesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});

export const UpdatePresentationPropertiesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	showType: z.enum(['presented', 'browsed', 'kiosk']).optional().describe('Slideshow mode'),
	loopContinuously: z.boolean().optional().describe('Loop the slideshow'),
	showWithNarration: z.boolean().optional().describe('Play narration'),
	showWithAnimation: z.boolean().optional().describe('Play animations'),
	advanceMode: z.enum(['manual', 'useTimings']).optional().describe('Slide advance mode'),
	showSlidesMode: z
		.enum(['all', 'customShow', 'range'])
		.optional()
		.describe('Which slides to show'),
	showSlidesFrom: z.number().int().min(1).optional().describe('Range start (1-based)'),
	showSlidesTo: z.number().int().min(1).optional().describe('Range end (1-based)'),
	penColor: z.string().optional().describe('Annotation pen color (hex)'),
});
