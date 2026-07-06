import { z } from 'zod';

export const SetElementLockSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('Element ID to lock/unlock'),
	locked: z.boolean().describe('Whether the element should be locked'),
	noMove: z.boolean().optional().describe('Prevent moving'),
	noResize: z.boolean().optional().describe('Prevent resizing'),
	noRotation: z.boolean().optional().describe('Prevent rotation'),
	noSelect: z.boolean().optional().describe('Prevent selection'),
	noTextEdit: z.boolean().optional().describe('Prevent text editing'),
});
