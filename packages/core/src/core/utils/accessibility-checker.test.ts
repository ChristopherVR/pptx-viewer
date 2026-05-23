import { describe, it, expect } from 'vitest';

import type { PptxElement } from '../types/elements';
import type { PptxData, PptxSlide } from '../types/presentation';
import {
	checkPresentation,
	checkMissingAltText,
	checkMissingSlideTitle,
	checkLowContrast,
	checkComplexTables,
	checkDuplicateTitles,
	checkBlankSlide,
	computeContrastRatio,
	parseHexColor,
	relativeLuminance,
} from './accessibility-checker';

// ---------------------------------------------------------------------------
// Helpers to build minimal test fixtures
// ---------------------------------------------------------------------------

function makeElement(
	overrides: { type: string; id: string } & Record<string, unknown>,
): PptxElement {
	return {
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as unknown as PptxElement;
}

function makeSlide(elements: PptxElement[], overrides: Partial<PptxSlide> = {}): PptxSlide {
	return {
		id: 'slide-1',
		rId: 'rId1',
		slideNumber: 1,
		elements,
		...overrides,
	} as PptxSlide;
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

describe('parseHexColor', () => {
	it('parses 6-digit hex with hash', () => {
		expect(parseHexColor('#FF8800')).toStrictEqual([255, 136, 0]);
	});

	it('parses 6-digit hex without hash', () => {
		expect(parseHexColor('00FF00')).toStrictEqual([0, 255, 0]);
	});

	it('parses 3-digit hex shorthand', () => {
		expect(parseHexColor('#F00')).toStrictEqual([255, 0, 0]);
	});

	it('returns null for invalid input', () => {
		expect(parseHexColor('xyz')).toBeNull();
		expect(parseHexColor('#12345')).toBeNull();
	});
});

describe('relativeLuminance', () => {
	it('returns 0 for black', () => {
		expect(relativeLuminance(0, 0, 0)).toBe(0);
	});

	it('returns 1 for white', () => {
		expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 2);
	});
});

describe('computeContrastRatio', () => {
	it('returns 21:1 for black on white', () => {
		const ratio = computeContrastRatio('#000000', '#FFFFFF');
		expect(ratio).toBeCloseTo(21, 0);
	});

	it('returns 1:1 for same colour', () => {
		expect(computeContrastRatio('#888888', '#888888')).toBeCloseTo(1, 1);
	});

	it('returns known ratio for #777 on #FFF', () => {
		const ratio = computeContrastRatio('#777777', '#FFFFFF');
		expect(ratio).toBeGreaterThan(4.4);
		expect(ratio).toBeLessThan(4.6);
	});

	it('returns 21 for unparseable colours (safe default)', () => {
		expect(computeContrastRatio('not-a-color', '#FFF')).toBe(21);
	});
});

// ---------------------------------------------------------------------------
// Missing alt text
// ---------------------------------------------------------------------------

describe('checkMissingAltText', () => {
	it('flags images without alt text', () => {
		const slide = makeSlide([makeElement({ type: 'image', id: 'img1' })]);
		const issues = checkMissingAltText(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].type).toBe('missingAltText');
		expect(issues[0].elementId).toBe('img1');
	});

	it('flags charts without alt text', () => {
		const slide = makeSlide([makeElement({ type: 'chart', id: 'chart1' })]);
		const issues = checkMissingAltText(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('Chart');
	});

	it('does not flag images with alt text', () => {
		const slide = makeSlide([makeElement({ type: 'image', id: 'img1', altText: 'Logo' })]);
		const issues = checkMissingAltText(slide, 0);
		expect(issues).toHaveLength(0);
	});

	it('does not flag text or shape elements', () => {
		const slide = makeSlide([
			makeElement({ type: 'text', id: 'txt1' }),
			makeElement({ type: 'shape', id: 'shp1' }),
		]);
		expect(checkMissingAltText(slide, 0)).toHaveLength(0);
	});

	it('skips hidden elements', () => {
		const slide = makeSlide([makeElement({ type: 'image', id: 'img1', hidden: true })]);
		expect(checkMissingAltText(slide, 0)).toHaveLength(0);
	});

	it('flags media elements without alt text', () => {
		const slide = makeSlide([makeElement({ type: 'media', id: 'vid1' })]);
		const issues = checkMissingAltText(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('Media');
	});

	it('flags SmartArt without alt text', () => {
		const slide = makeSlide([makeElement({ type: 'smartArt', id: 'sa1' })]);
		const issues = checkMissingAltText(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('SmartArt');
	});
});

// ---------------------------------------------------------------------------
// Missing slide title
// ---------------------------------------------------------------------------

describe('checkMissingSlideTitle', () => {
	it('flags slide without title element', () => {
		const slide = makeSlide([makeElement({ type: 'text', id: 'body-text' })]);
		const issues = checkMissingSlideTitle(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].type).toBe('missingSlideTitle');
	});

	it('flags slide with empty title', () => {
		const slide = makeSlide([makeElement({ type: 'text', id: 'title-1', text: '' })]);
		const issues = checkMissingSlideTitle(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].message).toContain('empty');
	});

	it('passes slide with populated title', () => {
		const slide = makeSlide([makeElement({ type: 'text', id: 'title-1', text: 'Hello World' })]);
		expect(checkMissingSlideTitle(slide, 0)).toHaveLength(0);
	});

	it('detects title via ctrTitle in id', () => {
		const slide = makeSlide([
			makeElement({ type: 'text', id: 'ctrTitle_42', text: 'Center Title' }),
		]);
		expect(checkMissingSlideTitle(slide, 0)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Low contrast
// ---------------------------------------------------------------------------

describe('checkLowContrast', () => {
	it('flags white text on light yellow background', () => {
		const el = makeElement({
			type: 'text',
			id: 'txt1',
			text: 'Hello',
			textStyle: { color: '#FFFFFF' },
			shapeStyle: { fillColor: '#FFFFCC' },
		});
		const slide = makeSlide([el]);
		const issues = checkLowContrast(slide, 0, 4.5);
		expect(issues).toHaveLength(1);
		expect(issues[0].type).toBe('lowContrast');
	});

	it('passes black text on white background', () => {
		const el = makeElement({
			type: 'text',
			id: 'txt1',
			text: 'Hello',
			textStyle: { color: '#000000' },
			shapeStyle: { fillColor: '#FFFFFF' },
		});
		const slide = makeSlide([el]);
		expect(checkLowContrast(slide, 0, 4.5)).toHaveLength(0);
	});

	it('uses slide background as fallback when shape has no fill', () => {
		const el = makeElement({
			type: 'text',
			id: 'txt1',
			text: 'Hello',
			textStyle: { color: '#FFFF00' },
		});
		const slide = makeSlide([el]);
		// Yellow on white (default bg) is low contrast
		const issues = checkLowContrast(slide, 0, 4.5, '#FFFFFF');
		expect(issues).toHaveLength(1);
	});

	it('skips elements without text', () => {
		const el = makeElement({
			type: 'text',
			id: 'txt1',
			text: '',
			textStyle: { color: '#FFF' },
		});
		const slide = makeSlide([el]);
		expect(checkLowContrast(slide, 0, 4.5)).toHaveLength(0);
	});

	it('skips elements without determinable text colour', () => {
		const el = makeElement({ type: 'text', id: 'txt1', text: 'Hello' });
		const slide = makeSlide([el]);
		expect(checkLowContrast(slide, 0, 4.5)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Complex tables
// ---------------------------------------------------------------------------

describe('checkComplexTables', () => {
	it('flags tables with more than 2 merged regions', () => {
		const el = makeElement({
			type: 'table',
			id: 'tbl1',
			tableData: {
				rows: [
					{
						cells: [
							{ text: 'A', gridSpan: 2 },
							{ text: 'B', gridSpan: 2 },
							{ text: 'C', rowSpan: 3 },
						],
					},
					{ cells: [{ text: 'D' }, { text: 'E' }, { text: 'F' }] },
				],
				columnWidths: [0.25, 0.25, 0.25, 0.25],
			},
		});
		const slide = makeSlide([el]);
		const issues = checkComplexTables(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].type).toBe('complexTable');
	});

	it('passes simple tables without merges', () => {
		const el = makeElement({
			type: 'table',
			id: 'tbl1',
			tableData: {
				rows: [
					{ cells: [{ text: 'A' }, { text: 'B' }] },
					{ cells: [{ text: 'C' }, { text: 'D' }] },
				],
				columnWidths: [0.5, 0.5],
			},
		});
		const slide = makeSlide([el]);
		expect(checkComplexTables(slide, 0)).toHaveLength(0);
	});

	it('passes tables with only 1-2 merges', () => {
		const el = makeElement({
			type: 'table',
			id: 'tbl1',
			tableData: {
				rows: [
					{ cells: [{ text: 'Header', gridSpan: 2 }] },
					{ cells: [{ text: 'A' }, { text: 'B' }] },
				],
				columnWidths: [0.5, 0.5],
			},
		});
		const slide = makeSlide([el]);
		expect(checkComplexTables(slide, 0)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Duplicate titles
// ---------------------------------------------------------------------------

describe('checkDuplicateTitles', () => {
	it('flags slides with identical titles', () => {
		const slides = [
			makeSlide([makeElement({ type: 'text', id: 'title-1', text: 'Overview' })]),
			makeSlide([makeElement({ type: 'text', id: 'title-2', text: 'Overview' })]),
		];
		const issues = checkDuplicateTitles(slides);
		expect(issues).toHaveLength(2);
		expect(issues[0].type).toBe('duplicateTitle');
	});

	it('is case-insensitive', () => {
		const slides = [
			makeSlide([makeElement({ type: 'text', id: 'title-1', text: 'overview' })]),
			makeSlide([makeElement({ type: 'text', id: 'title-2', text: 'OVERVIEW' })]),
		];
		expect(checkDuplicateTitles(slides)).toHaveLength(2);
	});

	it('does not flag unique titles', () => {
		const slides = [
			makeSlide([makeElement({ type: 'text', id: 'title-1', text: 'Intro' })]),
			makeSlide([makeElement({ type: 'text', id: 'title-2', text: 'Details' })]),
		];
		expect(checkDuplicateTitles(slides)).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// Blank slides
// ---------------------------------------------------------------------------

describe('checkBlankSlide', () => {
	it('flags slide with no elements', () => {
		const slide = makeSlide([]);
		const issues = checkBlankSlide(slide, 0);
		expect(issues).toHaveLength(1);
		expect(issues[0].type).toBe('blankSlide');
	});

	it('flags slide with only empty text elements', () => {
		const slide = makeSlide([
			makeElement({ type: 'text', id: 'txt1', text: '' }),
			makeElement({ type: 'shape', id: 'shp1', text: '  ' }),
		]);
		expect(checkBlankSlide(slide, 0)).toHaveLength(1);
	});

	it('passes slide with an image', () => {
		const slide = makeSlide([makeElement({ type: 'image', id: 'img1' })]);
		expect(checkBlankSlide(slide, 0)).toHaveLength(0);
	});

	it('passes slide with non-empty text', () => {
		const slide = makeSlide([makeElement({ type: 'text', id: 'txt1', text: 'Hello' })]);
		expect(checkBlankSlide(slide, 0)).toHaveLength(0);
	});

	it('skips hidden elements when checking for blank', () => {
		const slide = makeSlide([makeElement({ type: 'image', id: 'img1', hidden: true })]);
		expect(checkBlankSlide(slide, 0)).toHaveLength(1);
	});
});

// ---------------------------------------------------------------------------
// Full presentation check
// ---------------------------------------------------------------------------

describe('checkPresentation', () => {
	it('aggregates issues from all checks', () => {
		const slides = [
			makeSlide([
				makeElement({ type: 'image', id: 'img1' }), // missing alt text
				// no title → missing slide title
			]),
		];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;
		const issues = checkPresentation(data);
		expect(issues.length).toBeGreaterThanOrEqual(2);
		const types = new Set(issues.map((i) => i.type));
		expect(types.has('missingAltText')).toBeTruthy();
		expect(types.has('missingSlideTitle')).toBeTruthy();
	});

	it('sorts issues by slide index then severity', () => {
		const slides = [
			makeSlide([makeElement({ type: 'text', id: 'title-1', text: 'A' })]),
			makeSlide([makeElement({ type: 'image', id: 'img1' })]),
		];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;
		const issues = checkPresentation(data);
		for (let i = 1; i < issues.length; i++) {
			expect(issues[i].slideIndex).toBeGreaterThanOrEqual(issues[i - 1].slideIndex);
		}
	});

	it('respects skipContrast option', () => {
		const el = makeElement({
			type: 'text',
			id: 'title-txt',
			text: 'Hello',
			textStyle: { color: '#FFFFFF' },
			shapeStyle: { fillColor: '#FFFFCC' },
		});
		const slides = [makeSlide([el])];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;

		const withContrast = checkPresentation(data, { skipContrast: false });
		const withoutContrast = checkPresentation(data, { skipContrast: true });
		const contrastIssues = withContrast.filter((i) => i.type === 'lowContrast');
		const noContrastIssues = withoutContrast.filter((i) => i.type === 'lowContrast');
		expect(contrastIssues.length).toBeGreaterThan(0);
		expect(noContrastIssues).toHaveLength(0);
	});

	it('respects skipBlankSlide option', () => {
		const slides = [makeSlide([])];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;
		const without = checkPresentation(data, { skipBlankSlide: true });
		expect(without.filter((i) => i.type === 'blankSlide')).toHaveLength(0);
	});

	it('returns empty array for a fully accessible presentation', () => {
		const slides = [
			makeSlide([
				makeElement({ type: 'text', id: 'title-1', text: 'Slide Title' }),
				makeElement({ type: 'image', id: 'img1', altText: 'Description' }),
			]),
		];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;
		const issues = checkPresentation(data, { skipContrast: true });
		expect(issues).toHaveLength(0);
	});

	it('custom minContrastRatio is respected', () => {
		const el = makeElement({
			type: 'text',
			id: 'title-txt',
			text: 'Hello',
			textStyle: { color: '#777777' },
			shapeStyle: { fillColor: '#FFFFFF' },
		});
		const slides = [makeSlide([el])];
		const data = { slides, width: 1280, height: 720 } as unknown as PptxData;

		// #777 on #FFF is ~4.48:1, should pass at 3:1 but fail at 7:1
		const atLow = checkPresentation(data, { minContrastRatio: 3 });
		const atHigh = checkPresentation(data, { minContrastRatio: 7 });
		expect(atLow.filter((i) => i.type === 'lowContrast')).toHaveLength(0);
		expect(atHigh.filter((i) => i.type === 'lowContrast')).toHaveLength(1);
	});
});
