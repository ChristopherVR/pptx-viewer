import { z } from 'zod';

export const ManageSectionsSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	action: z
		.enum(['list', 'add', 'remove', 'reorder', 'moveSlides', 'getForSlide'])
		.describe('Section action'),
	name: z.string().optional().describe('Section name (for add)'),
	slideIndices: z
		.array(z.number().int().min(0))
		.optional()
		.describe('Slide indices (for add, moveSlides)'),
	sectionId: z.string().optional().describe('Section ID (for remove, moveSlides)'),
	sectionIds: z.array(z.string()).optional().describe('Ordered section IDs (for reorder)'),
	slideIndex: z.number().int().min(0).optional().describe('Slide index (for getForSlide)'),
});
