import { z } from 'zod';

export const ManageHyperlinksSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	action: z.enum(['list', 'set', 'remove']).describe('Hyperlink action'),
	elementId: z.string().optional().describe('Element ID (for set/remove)'),
	trigger: z.enum(['click', 'hover']).optional().describe('Action trigger (default: click)'),
	url: z.string().optional().describe('URL for the hyperlink'),
	tooltip: z.string().optional().describe('Tooltip text'),
	targetSlideIndex: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe('Target slide index for internal links'),
	actionType: z
		.enum(['url', 'slide', 'nextSlide', 'prevSlide', 'firstSlide', 'lastSlide', 'endShow'])
		.optional()
		.describe('Link action type'),
});
