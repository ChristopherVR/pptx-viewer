import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeLoadPipeline
// ---------------------------------------------------------------------------

interface XmlObject {
	[key: string]: unknown;
}

interface MockSlide {
	id: string;
	rawXml?: XmlObject;
	elements: unknown[];
	warnings?: MockWarning[];
}

interface MockWarning {
	slideId: string;
	message: string;
}

/**
 * Extracted from findMaxElementId — recursively walks XML to find the
 * highest numeric @_id attribute value.
 */
function findMaxElementId(slides: MockSlide[]): number {
	let max = 0;
	const visit = (node: unknown): void => {
		if (node === null || node === undefined || typeof node !== 'object') {
			return;
		}
		const obj = node as Record<string, unknown>;
		if ('@_id' in obj) {
			const id = parseInt(String(obj['@_id']), 10);
			if (Number.isFinite(id) && id > max) {
				max = id;
			}
		}
		for (const value of Object.values(obj)) {
			if (Array.isArray(value)) {
				for (const item of value) {
					visit(item);
				}
			} else if (typeof value === 'object' && value !== null) {
				visit(value);
			}
		}
	};
	for (const slide of slides) {
		visit(slide.rawXml);
	}
	return max;
}

/**
 * Extracted from attachSlideWarnings — filters warnings by slide ID and
 * attaches them to the appropriate slide.
 */
function attachSlideWarnings(slides: MockSlide[], warnings: MockWarning[]): MockSlide[] {
	return slides.map((slide) => ({
		...slide,
		warnings: warnings.filter((warning) => warning.slideId === slide.id),
	}));
}

// ---------------------------------------------------------------------------
// Tests: findMaxElementId
// ---------------------------------------------------------------------------
describe('findMaxElementId', () => {
	it('should return 0 for empty slides array', () => {
		expect(findMaxElementId([])).toBe(0);
	});

	it('should return 0 for slides with no rawXml', () => {
		const slides: MockSlide[] = [
			{ id: 'slide1', elements: [] },
			{ id: 'slide2', elements: [] },
		];
		expect(findMaxElementId(slides)).toBe(0);
	});

	it('should find a single @_id at the top level', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: { '@_id': '42' },
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(42);
	});

	it('should find the maximum @_id across nested nodes', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					'p:spTree': {
						'p:sp': [
							{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '5' } } },
							{ 'p:nvSpPr': { 'p:cNvPr': { '@_id': '10' } } },
						],
					},
				},
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(10);
	});

	it('should find the max across multiple slides', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: { 'p:sp': { '@_id': '3' } },
				elements: [],
			},
			{
				id: 'slide2',
				rawXml: { 'p:sp': { '@_id': '15' } },
				elements: [],
			},
			{
				id: 'slide3',
				rawXml: { 'p:sp': { '@_id': '7' } },
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(15);
	});

	it('should handle numeric @_id values', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: { '@_id': 99 },
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(99);
	});

	it('should ignore non-numeric @_id values', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					'p:sp': { '@_id': 'abc' },
					'p:pic': { '@_id': '5' },
				},
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(5);
	});

	it('should handle deeply nested structures', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					level1: {
						level2: {
							level3: {
								level4: {
									'@_id': '100',
								},
							},
						},
					},
				},
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(100);
	});

	it('should handle arrays within the XML structure', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					shapes: [{ '@_id': '1' }, { '@_id': '20' }, { nested: [{ '@_id': '50' }] }],
				},
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(50);
	});

	it('should handle slides with undefined rawXml', () => {
		const slides: MockSlide[] = [
			{ id: 'slide1', rawXml: undefined, elements: [] },
			{
				id: 'slide2',
				rawXml: { '@_id': '8' },
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(8);
	});

	it('should handle null values in XML objects', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					'@_id': '5',
					'p:sp': null,
				},
				elements: [],
			},
		];
		expect(findMaxElementId(slides)).toBe(5);
	});

	it('should ignore negative @_id values (still find max)', () => {
		const slides: MockSlide[] = [
			{
				id: 'slide1',
				rawXml: {
					'p:sp': { '@_id': '-3' },
					'p:pic': { '@_id': '0' },
				},
				elements: [],
			},
		];
		// -3 is finite, but max starts at 0 and -3 < 0 so max stays 0
		expect(findMaxElementId(slides)).toBe(0);
	});

	it('should handle empty rawXml objects', () => {
		const slides: MockSlide[] = [{ id: 'slide1', rawXml: {}, elements: [] }];
		expect(findMaxElementId(slides)).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// Tests: attachSlideWarnings
// ---------------------------------------------------------------------------
describe('attachSlideWarnings', () => {
	it('should attach matching warnings to slides', () => {
		const slides: MockSlide[] = [
			{ id: 'slide1', elements: [] },
			{ id: 'slide2', elements: [] },
		];
		const warnings: MockWarning[] = [
			{ slideId: 'slide1', message: 'Warning A' },
			{ slideId: 'slide2', message: 'Warning B' },
			{ slideId: 'slide1', message: 'Warning C' },
		];

		const result = attachSlideWarnings(slides, warnings);
		expect(result[0].warnings).toHaveLength(2);
		expect(result[0].warnings![0].message).toBe('Warning A');
		expect(result[0].warnings![1].message).toBe('Warning C');
		expect(result[1].warnings).toHaveLength(1);
		expect(result[1].warnings![0].message).toBe('Warning B');
	});

	it('should return empty warnings array for unmatched slides', () => {
		const slides: MockSlide[] = [{ id: 'slide1', elements: [] }];
		const warnings: MockWarning[] = [{ slideId: 'slide2', message: 'Orphan warning' }];

		const result = attachSlideWarnings(slides, warnings);
		expect(result[0].warnings).toHaveLength(0);
	});

	it('should handle empty slides array', () => {
		const result = attachSlideWarnings([], []);
		expect(result).toStrictEqual([]);
	});

	it('should handle empty warnings array', () => {
		const slides: MockSlide[] = [{ id: 'slide1', elements: [] }];
		const result = attachSlideWarnings(slides, []);
		expect(result[0].warnings).toHaveLength(0);
	});

	it('should preserve existing slide properties', () => {
		const slides: MockSlide[] = [{ id: 'slide1', elements: [{ type: 'text' }] }];
		const result = attachSlideWarnings(slides, []);
		expect(result[0].id).toBe('slide1');
		expect(result[0].elements).toHaveLength(1);
	});

	it('should not mutate the original slides array', () => {
		const slides: MockSlide[] = [{ id: 'slide1', elements: [] }];
		const warnings: MockWarning[] = [{ slideId: 'slide1', message: 'Test' }];
		const result = attachSlideWarnings(slides, warnings);
		expect(result).not.toBe(slides);
		expect(slides[0].warnings).toBeUndefined();
	});
});
