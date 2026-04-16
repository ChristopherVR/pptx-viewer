import { describe, it, expect } from 'vitest';

import {
	AddElementSchema,
	UpdateElementSchema,
	DeleteElementsSchema,
	GroupElementsSchema,
	BatchUpdateElementsSchema,
} from '../../schemas/element-schemas.js';
import {
	GetSlideSchema,
	AddSlideSchema,
	DeleteSlidesSchema,
	SetSlideTransitionSchema,
	SetCanvasSizeSchema,
	ConvertToMarkdownSchema,
	AccessibilityCheckSchema,
} from '../../schemas/slide-schemas.js';
import {
	UpdateTableCellsSchema,
	ManageTableStructureSchema,
	UpdateElementStyleSchema,
	FindTextSchema,
	ReplaceTextSchema,
	ManageCommentsSchema,
} from '../../schemas/table-style-schemas.js';

// ── Slide schemas ───────────────────────────────────────────────────────────

describe('slide schemas', () => {
	describe('getSlideSchema', () => {
		it('accepts valid input', () => {
			const result = GetSlideSchema.safeParse({ filePath: '/test.pptx', slideIndex: 0 });
			expect(result.success).toBe(true);
		});

		it('rejects missing filePath', () => {
			const result = GetSlideSchema.safeParse({ slideIndex: 0 });
			expect(result.success).toBe(false);
		});

		it('rejects negative slideIndex', () => {
			const result = GetSlideSchema.safeParse({ filePath: '/test.pptx', slideIndex: -1 });
			expect(result.success).toBe(false);
		});

		it('rejects non-integer slideIndex', () => {
			const result = GetSlideSchema.safeParse({ filePath: '/test.pptx', slideIndex: 1.5 });
			expect(result.success).toBe(false);
		});
	});

	describe('addSlideSchema', () => {
		it('accepts minimal input', () => {
			const result = AddSlideSchema.safeParse({ filePath: '/test.pptx' });
			expect(result.success).toBe(true);
		});

		it('accepts all options', () => {
			const result = AddSlideSchema.safeParse({
				filePath: '/test.pptx',
				insertAfterIndex: 2,
				backgroundColor: '#ff0000',
			});
			expect(result.success).toBe(true);
		});
	});

	describe('deleteSlidesSchema', () => {
		it('accepts valid input', () => {
			const result = DeleteSlidesSchema.safeParse({
				filePath: '/test.pptx',
				slideIndexes: [0, 1],
			});
			expect(result.success).toBe(true);
		});

		it('rejects empty slideIndexes array', () => {
			const result = DeleteSlidesSchema.safeParse({
				filePath: '/test.pptx',
				slideIndexes: [],
			});
			expect(result.success).toBe(false);
		});
	});

	describe('setCanvasSizeSchema', () => {
		it('accepts valid dimensions', () => {
			const result = SetCanvasSizeSchema.safeParse({
				filePath: '/test.pptx',
				width: 1920,
				height: 1080,
			});
			expect(result.success).toBe(true);
		});

		it('rejects non-positive width', () => {
			const result = SetCanvasSizeSchema.safeParse({
				filePath: '/test.pptx',
				width: 0,
				height: 1080,
			});
			expect(result.success).toBe(false);
		});

		it('rejects negative height', () => {
			const result = SetCanvasSizeSchema.safeParse({
				filePath: '/test.pptx',
				width: 1920,
				height: -10,
			});
			expect(result.success).toBe(false);
		});
	});

	describe('setSlideTransitionSchema', () => {
		it('accepts valid transition', () => {
			const result = SetSlideTransitionSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'fade',
				durationMs: 500,
			});
			expect(result.success).toBe(true);
		});

		it('accepts minimal transition', () => {
			const result = SetSlideTransitionSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'none',
			});
			expect(result.success).toBe(true);
		});
	});

	describe('accessibilityCheckSchema', () => {
		it('accepts only filePath', () => {
			const result = AccessibilityCheckSchema.safeParse({ filePath: '/test.pptx' });
			expect(result.success).toBe(true);
		});

		it('rejects missing filePath', () => {
			const result = AccessibilityCheckSchema.safeParse({});
			expect(result.success).toBe(false);
		});
	});
});

// ── Element schemas ─────────────────────────────────────────────────────────

describe('element schemas', () => {
	describe('addElementSchema', () => {
		it('accepts text element', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'text',
				text: 'Hello',
				fontSize: 24,
			});
			expect(result.success).toBe(true);
		});

		it('accepts shape element', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'shape',
				shapeType: 'rect',
				fillColor: '#ff0000',
			});
			expect(result.success).toBe(true);
		});

		it('accepts table element', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'table',
				rows: 3,
				columns: 4,
			});
			expect(result.success).toBe(true);
		});

		it('accepts connector element', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'connector',
				endArrow: 'triangle',
			});
			expect(result.success).toBe(true);
		});

		it('rejects invalid element type', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				type: 'invalid',
			});
			expect(result.success).toBe(false);
		});

		it('rejects missing slideIndex', () => {
			const result = AddElementSchema.safeParse({
				filePath: '/test.pptx',
				type: 'text',
			});
			expect(result.success).toBe(false);
		});
	});

	describe('updateElementSchema', () => {
		it('accepts position update', () => {
			const result = UpdateElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'el-0',
				x: 100,
				y: 200,
			});
			expect(result.success).toBe(true);
		});

		it('accepts opacity within range', () => {
			const result = UpdateElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'el-0',
				opacity: 0.5,
			});
			expect(result.success).toBe(true);
		});

		it('rejects opacity above 1', () => {
			const result = UpdateElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'el-0',
				opacity: 1.5,
			});
			expect(result.success).toBe(false);
		});

		it('rejects opacity below 0', () => {
			const result = UpdateElementSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'el-0',
				opacity: -0.1,
			});
			expect(result.success).toBe(false);
		});
	});

	describe('deleteElementsSchema', () => {
		it('accepts valid input', () => {
			const result = DeleteElementsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementIds: ['el-0', 'el-1'],
			});
			expect(result.success).toBe(true);
		});

		it('rejects empty elementIds', () => {
			const result = DeleteElementsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementIds: [],
			});
			expect(result.success).toBe(false);
		});
	});

	describe('groupElementsSchema', () => {
		it('accepts 2+ element IDs', () => {
			const result = GroupElementsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementIds: ['el-0', 'el-1'],
			});
			expect(result.success).toBe(true);
		});

		it('rejects fewer than 2 element IDs', () => {
			const result = GroupElementsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementIds: ['el-0'],
			});
			expect(result.success).toBe(false);
		});
	});

	describe('batchUpdateElementsSchema', () => {
		it('accepts valid batch update', () => {
			const result = BatchUpdateElementsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementIds: ['el-0'],
				opacity: 0.5,
				hidden: true,
			});
			expect(result.success).toBe(true);
		});
	});
});

// ── Table / style / content schemas ─────────────────────────────────────────

describe('table and style schemas', () => {
	describe('updateTableCellsSchema', () => {
		it('accepts valid cell updates', () => {
			const result = UpdateTableCellsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				cells: [{ row: 0, col: 0, text: 'Hello' }],
			});
			expect(result.success).toBe(true);
		});

		it('rejects empty cells array', () => {
			const result = UpdateTableCellsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				cells: [],
			});
			expect(result.success).toBe(false);
		});

		it('rejects negative row index', () => {
			const result = UpdateTableCellsSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				cells: [{ row: -1, col: 0, text: 'x' }],
			});
			expect(result.success).toBe(false);
		});
	});

	describe('manageTableStructureSchema', () => {
		it('accepts insertRow', () => {
			const result = ManageTableStructureSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'insertRow',
				position: 1,
			});
			expect(result.success).toBe(true);
		});

		it('accepts deleteColumn', () => {
			const result = ManageTableStructureSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'deleteColumn',
				referenceIndex: 0,
			});
			expect(result.success).toBe(true);
		});

		it('rejects invalid action', () => {
			const result = ManageTableStructureSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'tbl-0',
				action: 'dropTable',
			});
			expect(result.success).toBe(false);
		});
	});

	describe('updateElementStyleSchema', () => {
		it('accepts fill and stroke options', () => {
			const result = UpdateElementStyleSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'shape-0',
				fillColor: '#00ff00',
				strokeColor: '#0000ff',
				strokeWidth: 2,
			});
			expect(result.success).toBe(true);
		});

		it('accepts gradient stops', () => {
			const result = UpdateElementStyleSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'shape-0',
				fillGradientStops: [
					{ color: '#ff0000', position: 0 },
					{ color: '#0000ff', position: 1 },
				],
			});
			expect(result.success).toBe(true);
		});

		it('accepts image effects', () => {
			const result = UpdateElementStyleSchema.safeParse({
				filePath: '/test.pptx',
				slideIndex: 0,
				elementId: 'img-0',
				brightness: 20,
				contrast: -10,
				grayscale: true,
				altText: 'Photo of sunset',
			});
			expect(result.success).toBe(true);
		});
	});
});

describe('content schemas', () => {
	describe('findTextSchema', () => {
		it('accepts simple text query', () => {
			const result = FindTextSchema.safeParse({
				filePath: '/test.pptx',
				query: 'hello',
			});
			expect(result.success).toBe(true);
		});

		it('accepts all options', () => {
			const result = FindTextSchema.safeParse({
				filePath: '/test.pptx',
				query: '\\d+',
				useRegex: true,
				caseSensitive: true,
				slideIndexes: [0, 1],
			});
			expect(result.success).toBe(true);
		});

		it('rejects missing query', () => {
			const result = FindTextSchema.safeParse({ filePath: '/test.pptx' });
			expect(result.success).toBe(false);
		});
	});

	describe('replaceTextSchema', () => {
		it('accepts valid replace', () => {
			const result = ReplaceTextSchema.safeParse({
				filePath: '/test.pptx',
				query: 'old',
				replacement: 'new',
			});
			expect(result.success).toBe(true);
		});

		it('rejects missing replacement', () => {
			const result = ReplaceTextSchema.safeParse({
				filePath: '/test.pptx',
				query: 'old',
			});
			expect(result.success).toBe(false);
		});
	});

	describe('manageCommentsSchema', () => {
		it('accepts list action', () => {
			const result = ManageCommentsSchema.safeParse({
				filePath: '/test.pptx',
				action: 'list',
			});
			expect(result.success).toBe(true);
		});

		it('accepts add action with text', () => {
			const result = ManageCommentsSchema.safeParse({
				filePath: '/test.pptx',
				action: 'add',
				slideIndex: 0,
				text: 'A comment',
				author: 'Alice',
			});
			expect(result.success).toBe(true);
		});

		it('accepts delete action', () => {
			const result = ManageCommentsSchema.safeParse({
				filePath: '/test.pptx',
				action: 'delete',
				commentId: 'c-123',
			});
			expect(result.success).toBe(true);
		});

		it('accepts resolve action', () => {
			const result = ManageCommentsSchema.safeParse({
				filePath: '/test.pptx',
				action: 'resolve',
				commentId: 'c-123',
				resolved: true,
			});
			expect(result.success).toBe(true);
		});

		it('rejects invalid action', () => {
			const result = ManageCommentsSchema.safeParse({
				filePath: '/test.pptx',
				action: 'edit',
			});
			expect(result.success).toBe(false);
		});
	});

	describe('convertToMarkdownSchema', () => {
		it('accepts minimal input', () => {
			const result = ConvertToMarkdownSchema.safeParse({ filePath: '/test.pptx' });
			expect(result.success).toBe(true);
		});

		it('accepts all options', () => {
			const result = ConvertToMarkdownSchema.safeParse({
				filePath: '/test.pptx',
				outputDir: '/out',
				mediaFolderName: 'images',
				includeMetadata: true,
				slideRange: { start: 0, end: 5 },
				includeSpeakerNotes: true,
				semanticMode: true,
			});
			expect(result.success).toBe(true);
		});
	});
});
