import { z } from 'zod';

export const ManageSmartArtSchema = z.object({
	filePath: z.string().describe('Path to the PPTX file'),
	slideIndex: z.number().int().min(0).describe('Zero-based slide index'),
	elementId: z.string().describe('SmartArt element ID'),
	action: z
		.enum([
			'getNodes',
			'addNode',
			'removeNode',
			'updateNodeText',
			'reorderNode',
			'promoteNode',
			'demoteNode',
			'decompose',
		])
		.describe('SmartArt action'),
	nodeId: z.string().optional().describe('Node ID (required for most actions)'),
	text: z.string().optional().describe('Text for addNode or updateNodeText'),
	afterNodeId: z.string().optional().describe('Insert after this node ID'),
	direction: z.number().optional().describe('Reorder direction: 1 (forward) or -1 (backward)'),
});
