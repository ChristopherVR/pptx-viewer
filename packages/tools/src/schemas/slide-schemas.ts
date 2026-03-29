import { z } from 'zod';

export const GetSlideSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
});

export const AddSlideSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	insertAfterIndex: z.number().int().min(0).optional().describe('Insert after this slide index'),
	backgroundColor: z.string().optional().describe('Background color (hex)'),
});

export const DeleteSlidesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndexes: z.array(z.number().int().min(0)).min(1).describe('Slide indexes to delete'),
});

export const ReorderSlidesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	newOrder: z.array(z.number().int().min(0)).min(1).describe('New slide order as array of indexes'),
});

export const DuplicateSlideSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Slide to duplicate'),
	targetIndex: z.number().int().min(0).optional().describe('Where to insert the duplicate'),
});

export const UpdateSlidePropertiesSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	backgroundColor: z.string().optional().describe('Background color (hex)'),
	backgroundGradient: z.string().optional().describe('Background gradient CSS'),
	backgroundImage: z.string().optional().describe('Background image data URL'),
	notes: z.string().optional().describe('Speaker notes text'),
	hidden: z.boolean().optional().describe('Whether slide is hidden'),
});

export const SetSlideTransitionSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	type: z.string().describe('Transition type (e.g. "fade", "wipe", "none")'),
	durationMs: z.number().int().min(0).optional().describe('Duration in ms'),
	direction: z.string().optional().describe('Direction (e.g. "left", "right")'),
	advanceOnClick: z.boolean().optional().describe('Advance on mouse click'),
	advanceAfterMs: z.number().int().min(0).optional().describe('Auto-advance after ms'),
});

export const SetCanvasSizeSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	width: z.number().positive().describe('Canvas width in points'),
	height: z.number().positive().describe('Canvas height in points'),
});

export const ConvertToMarkdownSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	outputDir: z.string().optional().describe('Output directory for markdown and media'),
	mediaFolderName: z.string().optional().describe('Name for extracted media folder'),
	includeMetadata: z.boolean().optional().describe('Include presentation metadata'),
	slideRange: z
		.object({
			start: z.number().int().min(0).optional(),
			end: z.number().int().min(0).optional(),
		})
		.optional()
		.describe('Slide range to convert'),
	includeSpeakerNotes: z.boolean().optional().describe('Include speaker notes'),
	semanticMode: z.boolean().optional().describe('Use semantic (clean) markdown mode'),
});

export const AccessibilityCheckSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
});
