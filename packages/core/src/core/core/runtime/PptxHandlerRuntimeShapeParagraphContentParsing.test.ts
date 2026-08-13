import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { requireFixture } from '../../../__tests__/require-fixture';
import { PptxHandler } from '../../PptxHandler';
import type { TextSegment, XmlObject } from '../../types';
import {
	breakAutoNumberRun,
	createAutoNumberSequence,
	nextAutoNumber,
} from './auto-number-sequence';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';
// Since collectShapeParagraphContent is a protected method on a deeply
// chained mixin with many dependencies, we test the self-contained
// content extraction logic used within it.

function ensureArray(val: unknown): unknown[] {
	if (val === undefined || val === null) {
		return [];
	}
	return Array.isArray(val) ? val : [val];
}

// --- Extracted: run text extraction logic ---
function extractRunText(r: Record<string, unknown>): string {
	if (!r) {
		return '';
	}
	return typeof r['a:t'] === 'string' ? r['a:t'] : r['a:t'] !== undefined ? String(r['a:t']) : '';
}

// --- Extracted: field text + metadata extraction ---
function extractFieldInfo(field: Record<string, unknown>): {
	text: string;
	fieldType?: string;
	fieldGuid?: string;
} {
	const fieldText =
		typeof field['a:t'] === 'string'
			? field['a:t']
			: field['a:t'] !== undefined
				? String(field['a:t'])
				: '';
	const fldType = String(field['@_type'] || '').trim() || undefined;
	const fldGuid = String(field['@_uuid'] || field['@_id'] || '').trim() || undefined;
	return { text: fieldText, fieldType: fldType, fieldGuid: fldGuid };
}

// --- Extracted: content collection from a paragraph node ---
// Mirrors the document-order processing in collectShapeParagraphContent:
// iterates over object keys so that interleaved elements (runs, fields,
// math, mc:AlternateContent, line breaks) appear in the order they were
// parsed from the XML.
function collectParagraphTextParts(
	p: Record<string, unknown>,
	pIdx: number,
	paraCount: number,
): {
	parts: string[];
	runCount: number;
	fieldCount: number;
	lineBreakCount: number;
	hasMathElements: boolean;
} {
	const parts: string[] = [];
	let runCount = 0;
	let fieldCount = 0;
	let lineBreakCount = 0;
	let hasMathElements = false;

	const contentTagSet = new Set([
		'a:r',
		'a:fld',
		'a:t',
		'a14:m',
		'm:oMathPara',
		'm:oMath',
		'mc:AlternateContent',
		'a:br',
	]);

	for (const key of Object.keys(p)) {
		if (!contentTagSet.has(key)) {
			continue;
		}

		const items = ensureArray(p[key]);
		for (const item of items) {
			switch (key) {
				case 'a:r':
					if (!item) {
						break;
					}
					parts.push(extractRunText(item as Record<string, unknown>));
					runCount++;
					break;
				case 'a:fld':
					if (!item) {
						break;
					}
					parts.push(extractFieldInfo(item as Record<string, unknown>).text);
					fieldCount++;
					break;
				case 'a:t': {
					const directText =
						typeof item === 'string' ? item : item !== undefined ? String(item) : '';
					parts.push(directText);
					break;
				}
				case 'a14:m':
				case 'm:oMathPara':
				case 'm:oMath':
					if (!item) {
						break;
					}
					parts.push('[Equation]');
					hasMathElements = true;
					break;
				case 'mc:AlternateContent': {
					// Simplified: check for a14:m inside mc:Choice
					const acObj = item as Record<string, unknown>;
					const choices = ensureArray(acObj['mc:Choice']);
					let handled = false;
					for (const choice of choices) {
						const ch = choice as Record<string, unknown>;
						const innerMath = ch['a14:m'] ?? ch['m:oMathPara'] ?? ch['m:oMath'];
						if (innerMath) {
							parts.push('[Equation]');
							hasMathElements = true;
							handled = true;
							break;
						}
					}
					if (!handled) {
						// Fallback: check for runs in the fallback branch
						const fallback = acObj['mc:Fallback'] as Record<string, unknown> | undefined;
						if (fallback) {
							const fbRuns = ensureArray(fallback['a:r']);
							for (const r of fbRuns) {
								if (!r) {
									continue;
								}
								parts.push(extractRunText(r as Record<string, unknown>));
								runCount++;
							}
						}
					}
					break;
				}
				case 'a:br':
					parts.push('\n');
					lineBreakCount++;
					break;
			}
		}
	}

	// Inter-paragraph newline
	if (pIdx < paraCount - 1) {
		parts.push('\n');
	}

	return {
		parts,
		runCount,
		fieldCount,
		lineBreakCount,
		hasMathElements,
	};
}

// --- Extracted: bullet text formatting ---
// The ordinal is supplied by the caller because it belongs to the list the
// paragraph sits in, not to the paragraph's position in the text body; the
// production walk resolves it through `auto-number-sequence`.
function formatBulletText(
	bulletInfo: {
		char?: string;
		autoNumType?: string;
		imageRelId?: string;
		none?: boolean;
	},
	ordinal: number,
): string | null {
	if (!bulletInfo || bulletInfo.none) {
		return null;
	}

	if (bulletInfo.char) {
		return `${bulletInfo.char} `;
	}
	if (bulletInfo.autoNumType) {
		// Simplified: just return arabic format for testing
		return `${ordinal}. `;
	}
	if (bulletInfo.imageRelId) {
		// A picture bullet has no TEXT marker: the image is the marker and every
		// renderer paints it from `bulletInfo`. See the real-runtime coverage at
		// the bottom of this file.
		return '';
	}
	return '\u2022 ';
}

// ---------------------------------------------------------------------------
// extractRunText
// ---------------------------------------------------------------------------
describe('extractRunText', () => {
	it('should extract string text from a:t', () => {
		expect(extractRunText({ 'a:t': 'Hello' })).toBe('Hello');
	});

	it('should convert numeric a:t to string', () => {
		expect(extractRunText({ 'a:t': 42 })).toBe('42');
	});

	it('should return empty string when a:t is undefined', () => {
		expect(extractRunText({})).toBe('');
	});

	it('should return empty string for null input', () => {
		expect(extractRunText(null as unknown as Record<string, unknown>)).toBe('');
	});

	it('should handle boolean a:t', () => {
		expect(extractRunText({ 'a:t': true })).toBe('true');
	});

	it('should handle empty string a:t', () => {
		expect(extractRunText({ 'a:t': '' })).toBe('');
	});
});

// ---------------------------------------------------------------------------
// extractFieldInfo
// ---------------------------------------------------------------------------
describe('extractFieldInfo', () => {
	it('should extract field text and type', () => {
		const result = extractFieldInfo({
			'a:t': '2024-01-01',
			'@_type': 'datetime',
			'@_uuid': '{ABC-123}',
		});
		expect(result).toStrictEqual({
			text: '2024-01-01',
			fieldType: 'datetime',
			fieldGuid: '{ABC-123}',
		});
	});

	it('should use @_id as fallback for guid', () => {
		const result = extractFieldInfo({
			'a:t': '5',
			'@_type': 'slidenum',
			'@_id': '{DEF-456}',
		});
		expect(result.fieldGuid).toBe('{DEF-456}');
	});

	it('should handle missing type and guid', () => {
		const result = extractFieldInfo({ 'a:t': 'text' });
		expect(result).toStrictEqual({
			text: 'text',
			fieldType: undefined,
			fieldGuid: undefined,
		});
	});

	it('should return empty text when a:t is missing', () => {
		const result = extractFieldInfo({ '@_type': 'datetime' });
		expect(result.text).toBe('');
	});

	it('should trim empty type to undefined', () => {
		const result = extractFieldInfo({ 'a:t': 'x', '@_type': '  ' });
		expect(result.fieldType).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// collectParagraphTextParts
// ---------------------------------------------------------------------------
describe('collectParagraphTextParts', () => {
	it('should collect text from a single run', () => {
		const result = collectParagraphTextParts({ 'a:r': { 'a:t': 'Hello' } }, 0, 1);
		expect(result.parts).toStrictEqual(['Hello']);
		expect(result.runCount).toBe(1);
	});

	it('should collect text from multiple runs', () => {
		const result = collectParagraphTextParts(
			{
				'a:r': [{ 'a:t': 'Hello ' }, { 'a:t': 'World' }],
			},
			0,
			1,
		);
		expect(result.parts).toStrictEqual(['Hello ', 'World']);
		expect(result.runCount).toBe(2);
	});

	it('should collect text from fields', () => {
		const result = collectParagraphTextParts(
			{
				'a:fld': { 'a:t': 'Slide 1', '@_type': 'slidenum' },
			},
			0,
			1,
		);
		expect(result.parts).toStrictEqual(['Slide 1']);
		expect(result.fieldCount).toBe(1);
	});

	it('should collect direct text from a:t on paragraph', () => {
		const result = collectParagraphTextParts({ 'a:t': 'Direct text' }, 0, 1);
		expect(result.parts).toStrictEqual(['Direct text']);
	});

	it('should add [Equation] for math elements (a14:m)', () => {
		const result = collectParagraphTextParts({ 'a14:m': { 'm:oMath': {} } }, 0, 1);
		expect(result.parts).toContain('[Equation]');
		expect(result.hasMathElements).toBeTruthy();
	});

	it('should add [Equation] for m:oMathPara', () => {
		const result = collectParagraphTextParts({ 'm:oMathPara': { 'm:oMath': {} } }, 0, 1);
		expect(result.parts).toContain('[Equation]');
		expect(result.hasMathElements).toBeTruthy();
	});

	it('should add [Equation] for m:oMath', () => {
		const result = collectParagraphTextParts({ 'm:oMath': {} }, 0, 1);
		expect(result.parts).toContain('[Equation]');
		expect(result.hasMathElements).toBeTruthy();
	});

	it('should handle line breaks (a:br)', () => {
		const result = collectParagraphTextParts({ 'a:r': { 'a:t': 'Before' }, 'a:br': {} }, 0, 1);
		expect(result.parts).toContain('\n');
		expect(result.lineBreakCount).toBe(1);
	});

	it('should handle multiple line breaks', () => {
		const result = collectParagraphTextParts({ 'a:br': [{}, {}] }, 0, 1);
		expect(result.lineBreakCount).toBe(2);
		expect(result.parts.filter((p) => p === '\n')).toHaveLength(2);
	});

	it('should add newline between paragraphs (not after last)', () => {
		const result0 = collectParagraphTextParts({ 'a:r': { 'a:t': 'P1' } }, 0, 2);
		const result1 = collectParagraphTextParts({ 'a:r': { 'a:t': 'P2' } }, 1, 2);
		expect(result0.parts).toStrictEqual(['P1', '\n']);
		expect(result1.parts).toStrictEqual(['P2']); // No trailing newline
	});

	it('should handle empty paragraph', () => {
		const result = collectParagraphTextParts({}, 0, 1);
		expect(result.parts).toStrictEqual([]);
		expect(result.runCount).toBe(0);
		expect(result.fieldCount).toBe(0);
	});

	it('should handle combined runs, fields, and breaks', () => {
		const result = collectParagraphTextParts(
			{
				'a:r': [{ 'a:t': 'Hello ' }, { 'a:t': 'World' }],
				'a:fld': { 'a:t': '5', '@_type': 'slidenum' },
				'a:br': {},
			},
			0,
			2,
		);
		expect(result.parts).toStrictEqual(['Hello ', 'World', '5', '\n', '\n']);
		expect(result.runCount).toBe(2);
		expect(result.fieldCount).toBe(1);
		expect(result.lineBreakCount).toBe(1);
	});

	it('should process mc:AlternateContent containing a14:m as inline math', () => {
		// Simulates: <a:r>text</a:r><mc:AlternateContent><mc:Choice Requires="a14"><a14:m>...</a14:m></mc:Choice></mc:AlternateContent>
		const result = collectParagraphTextParts(
			{
				'a:r': { 'a:t': 'The formula is ' },
				'mc:AlternateContent': {
					'mc:Choice': {
						'@_Requires': 'a14',
						'a14:m': { 'm:oMathPara': { 'm:oMath': { 'm:r': { 'm:t': 'x=1' } } } },
					},
					'mc:Fallback': {
						'a:r': { 'a:t': 'x=1' },
					},
				},
			},
			0,
			1,
		);
		expect(result.parts).toStrictEqual(['The formula is ', '[Equation]']);
		expect(result.hasMathElements).toBeTruthy();
		expect(result.runCount).toBe(1);
	});

	it('should preserve document order: run, inline math, run', () => {
		// When fast-xml-parser groups same-tag siblings, the key order
		// determines processing order. This test verifies that when
		// a:r appears before mc:AlternateContent in key order, both
		// runs process first, then the math — matching the grouped
		// object structure produced by the parser.
		const result = collectParagraphTextParts(
			{
				'a:r': [{ 'a:t': 'Before ' }, { 'a:t': ' after' }],
				'mc:AlternateContent': {
					'mc:Choice': {
						'@_Requires': 'a14',
						'a14:m': { 'm:oMath': {} },
					},
					'mc:Fallback': {
						'a:r': { 'a:t': 'E=mc2' },
					},
				},
			},
			0,
			1,
		);
		// a:r key comes first, so both runs are processed, then mc:AlternateContent
		expect(result.parts).toStrictEqual(['Before ', ' after', '[Equation]']);
		expect(result.hasMathElements).toBeTruthy();
	});

	it('should handle standalone a14:m inline math (no mc:AlternateContent wrapper)', () => {
		const result = collectParagraphTextParts(
			{
				'a:r': { 'a:t': 'See: ' },
				'a14:m': { 'm:oMathPara': { 'm:oMath': { 'm:r': { 'm:t': 'a+b' } } } },
			},
			0,
			1,
		);
		expect(result.parts).toStrictEqual(['See: ', '[Equation]']);
		expect(result.hasMathElements).toBeTruthy();
	});

	it('should handle mc:AlternateContent with non-math content as fallback', () => {
		// When mc:Choice does not contain math, and there is no a14:m,
		// the fallback text runs should be used.
		const result = collectParagraphTextParts(
			{
				'a:r': { 'a:t': 'Before ' },
				'mc:AlternateContent': {
					'mc:Choice': {
						'@_Requires': 'xyz_unsupported',
						'p:newFeature': {},
					},
					'mc:Fallback': {
						'a:r': { 'a:t': 'fallback text' },
					},
				},
			},
			0,
			1,
		);
		expect(result.parts).toStrictEqual(['Before ', 'fallback text']);
		expect(result.hasMathElements).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// formatBulletText
// ---------------------------------------------------------------------------
describe('formatBulletText', () => {
	it('should return null for null bulletInfo', () => {
		expect(formatBulletText(null as unknown as { none?: boolean }, 1)).toBeNull();
	});

	it('should return null when bullet is explicitly none', () => {
		expect(formatBulletText({ none: true }, 1)).toBeNull();
	});

	it('should format char bullet', () => {
		expect(formatBulletText({ char: '\u2022' }, 1)).toBe('\u2022 ');
	});

	it('should format char bullet with custom character', () => {
		expect(formatBulletText({ char: '-' }, 1)).toBe('- ');
	});

	it('should format auto-number bullet', () => {
		expect(formatBulletText({ autoNumType: 'arabicPeriod' }, 1)).toBe('1. ');
	});

	it('should emit no text marker for a picture bullet', () => {
		expect(formatBulletText({ imageRelId: 'rId5' }, 1)).toBe('');
	});

	it('should default to bullet character when no specific type', () => {
		expect(formatBulletText({}, 1)).toBe('\u2022 ');
	});

	it('numbers a list from its own start, not from the top of the text body', () => {
		const sequence = createAutoNumberSequence();
		// A title and an intro sentence precede the list.
		breakAutoNumberRun(sequence, 0);
		breakAutoNumberRun(sequence, 0);
		const first = nextAutoNumber(sequence, 0, 'arabicPeriod', 1);
		const second = nextAutoNumber(sequence, 0, 'arabicPeriod', 1);

		expect(formatBulletText({ autoNumType: 'arabicPeriod' }, first)).toBe('1. ');
		expect(formatBulletText({ autoNumType: 'arabicPeriod' }, second)).toBe('2. ');
	});
});

// ---------------------------------------------------------------------------
// Regression coverage against the REAL `collectShapeParagraphContent`.
//
// The marker segment this method stamps competes with the marker the renderer
// resolves from the same `BulletInfo`: the paragraph builder drops the segment
// only when the two strings agree (`text-paragraphs.ts`), so any disagreement
// paints BOTH markers.
// ---------------------------------------------------------------------------

class ParagraphContentRuntime extends PptxHandlerRuntime {
	public collect(
		p: XmlObject,
		pIdx: number,
		paraCount: number,
		sequence = createAutoNumberSequence(),
	) {
		return this.collectShapeParagraphContent(p, pIdx, paraCount, 'left', {}, {
			txBody: undefined,
			inheritedTxBody: undefined,
			bodyDefaultRunStyle: {},
			slideRelationshipMap: undefined,
			placeholderInfo: undefined,
			phDefaults: undefined,
			slidePath: 'ppt/slides/slide1.xml',
			effectiveLevelStyles: undefined,
			autoNumbering: sequence,
		} as never);
	}
}

const pictureBulletParagraph: XmlObject = {
	'a:pPr': { 'a:buBlip': { 'a:blip': { '@_r:embed': 'rId7' } } },
	'a:r': { 'a:t': 'Item text' },
};

describe('collectShapeParagraphContent - bullet markers (real runtime)', () => {
	it('stamps no display glyph for a picture bullet, only the bullet metadata', () => {
		const { segments, parts } = new ParagraphContentRuntime().collect(pictureBulletParagraph, 0, 1);

		// The marker segment survives (it carries `bulletInfo` for the renderers
		// and the writer) but contributes no text of its own.
		expect(segments[0].text).toBe('');
		expect(segments[0].bulletInfo?.imageRelId).toBe('rId7');
		expect(segments[1].text).toBe('Item text');
		// The paperclip must not reach the element's plain text either.
		expect(parts.join('')).toBe('Item text');
		expect(parts.join('')).not.toContain('\u{1F4CE}');
	});

	it('keeps the bullet-glyph fallback when the picture cannot be resolved', () => {
		// No `r:embed` to resolve, so every renderer falls back to the '•'
		// marker text; core must still stamp it.
		const { segments } = new ParagraphContentRuntime().collect(
			{
				'a:pPr': { 'a:buBlip': {} },
				'a:r': { 'a:t': 'Item text' },
			},
			0,
			1,
		);
		expect(segments[0].text).toBe('• ');
	});

	it('stamps an East-Asian auto-number marker in its own script', () => {
		const { segments } = new ParagraphContentRuntime().collect(
			{
				'a:pPr': { 'a:buAutoNum': { '@_type': 'ea1ChsPeriod' } },
				'a:r': { 'a:t': 'Item text' },
			},
			0,
			1,
		);
		expect(segments[0].text).toBe('一. ');
	});

	it('publishes the list ordinal, not the paragraph position, on the bullet info', () => {
		// A title and an intro paragraph precede the list, so the first numbered
		// paragraph is the THIRD paragraph of the body but the FIRST list item.
		// Consumers that re-derive the marker compute
		// `autoNumStartAt + paragraphIndex`, so publishing the raw position made
		// them render "3." against core's "1." and both markers were painted.
		const runtime = new ParagraphContentRuntime();
		const sequence = createAutoNumberSequence();
		runtime.collect({ 'a:r': { 'a:t': 'Title' } }, 0, 3, sequence);
		runtime.collect({ 'a:r': { 'a:t': 'Intro' } }, 1, 3, sequence);
		const { segments } = runtime.collect(
			{
				'a:pPr': { 'a:buAutoNum': { '@_type': 'arabicPeriod' } },
				'a:r': { 'a:t': 'First item' },
			},
			2,
			3,
			sequence,
		);

		expect(segments[0].text).toBe('1. ');
		const info = segments[0].bulletInfo;
		expect(info?.paragraphIndex).toBe(0);
		expect((info?.autoNumStartAt ?? 1) + (info?.paragraphIndex ?? 0)).toBe(1);
	});

	it('honours a startAt offset when publishing the ordinal', () => {
		const { segments } = new ParagraphContentRuntime().collect(
			{
				'a:pPr': { 'a:buAutoNum': { '@_type': 'arabicPeriod', '@_startAt': '5' } },
				'a:r': { 'a:t': 'Item text' },
			},
			0,
			1,
		);
		expect(segments[0].text).toBe('5. ');
		const info = segments[0].bulletInfo;
		expect((info?.autoNumStartAt ?? 1) + (info?.paragraphIndex ?? 0)).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// `a:endParaRPr` on an EMPTY paragraph.
//
// A trailing/only empty paragraph produced no segment, so its end-paragraph run
// properties were captured nowhere and the writer rebuilt them as the bare
// `<a:endParaRPr lang="en-US"/>` stub. That is what PowerPoint sizes and styles
// a BLANK line from (and it carries the `a:uLnTx` / `a:uFillTx` underline
// markers), so the deck's vertical layout changed on every round-trip.
// ---------------------------------------------------------------------------

const richEndParaRPr: XmlObject = {
	'@_lang': 'en-US',
	'@_sz': '1800',
	'@_b': '0',
	'@_u': 'none',
	'@_kern': '1200',
	'@_cap': 'none',
	'a:uLnTx': '',
	'a:uFillTx': '',
	'a:latin': { '@_typeface': 'Calibri', '@_panose': '020F0502020204030204' },
};

describe('collectShapeParagraphContent - empty paragraph metadata (real runtime)', () => {
	it('captures endParaRPr attributes AND children for a body of one empty paragraph', () => {
		const { segments, parts } = new ParagraphContentRuntime().collect(
			{ 'a:pPr': { '@_algn': 'ctr' }, 'a:endParaRPr': richEndParaRPr },
			0,
			1,
		);

		expect(segments).toHaveLength(1);
		expect(segments[0].text).toBe('');
		expect(parts.join('')).toBe('');
		const captured = segments[0].endParaRunProperties;
		expect(captured?.['@_sz']).toBe('1800');
		expect(captured?.['@_kern']).toBe('1200');
		expect(captured?.['@_cap']).toBe('none');
		// Children, not just attributes.
		expect(captured?.['a:uLnTx']).toBe('');
		expect(captured?.['a:uFillTx']).toBe('');
		expect(captured?.['a:latin']).toStrictEqual({
			'@_typeface': 'Calibri',
			'@_panose': '020F0502020204030204',
		});
		// The blank line is sized from `a:endParaRPr sz`, as for the separator
		// segment of a non-last empty paragraph (18pt at 96dpi).
		expect(segments[0].style.fontSize).toBeCloseTo(24, 5);
	});

	it('captures endParaRPr on a trailing empty paragraph without adding one', () => {
		const runtime = new ParagraphContentRuntime();
		const first = runtime.collect({ 'a:r': { 'a:t': 'Body' } }, 0, 2);
		const last = runtime.collect({ 'a:endParaRPr': richEndParaRPr }, 1, 2);

		// Paragraph 0 keeps its own terminator; paragraph 1 gains the carrier.
		expect(first.segments.map((s) => s.text)).toStrictEqual(['Body', '\n']);
		expect(last.segments).toHaveLength(1);
		expect(last.segments[0].endParaRunProperties?.['@_kern']).toBe('1200');
	});

	it('leaves a genuinely bare empty paragraph without a segment', () => {
		const { segments } = new ParagraphContentRuntime().collect({}, 0, 1);
		expect(segments).toStrictEqual([]);
	});
});

describe('endParaRPr survives a real-deck load (anatidae-animation.pptx)', () => {
	const fixture = requireFixture(
		fileURLToPath(
			new URL('../../../../../../e2e/fixtures/anatidae-animation.pptx', import.meta.url),
		),
	);

	it('carries the authored end properties of an empty-paragraph shape into the model', async () => {
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);

		const captured = data.slides[0].elements
			.flatMap((el) => (el as { textSegments?: TextSegment[] }).textSegments ?? [])
			.map((segment) => segment.endParaRunProperties)
			.filter((props): props is Record<string, unknown> => props !== undefined);

		// Slide 1's decorative rectangles are single empty paragraphs whose
		// endParaRPr carries the full run formatting.
		const rich = captured.find((props) => props['@_kern'] !== undefined);
		expect(rich).toBeDefined();
		expect(rich?.['@_sz']).toBe('1800');
		expect(rich?.['@_cap']).toBe('none');
		expect(rich?.['a:uLnTx']).toBeDefined();
		expect(rich?.['a:uFillTx']).toBeDefined();
	});

	it('round-trips those end properties through a load -> save -> reload', async () => {
		const bytes = readFileSync(fixture);
		const handler = new PptxHandler();
		const data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
		const saved = await handler.save(data.slides);

		const reloaded = await new PptxHandler().load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);
		const captured = reloaded.slides[0].elements
			.flatMap((el) => (el as { textSegments?: TextSegment[] }).textSegments ?? [])
			.map((segment) => segment.endParaRunProperties)
			.filter((props): props is Record<string, unknown> => props !== undefined);

		const rich = captured.find((props) => props['@_kern'] !== undefined);
		// Every one of these came back as `<a:endParaRPr lang="en-US"/>`.
		expect(rich).toBeDefined();
		expect(rich?.['@_sz']).toBe('1800');
		expect(rich?.['@_b']).toBe('0');
		expect(rich?.['@_u']).toBe('none');
		expect(rich?.['@_cap']).toBe('none');
		// Children survive too, not just attributes.
		expect(rich?.['a:uLnTx']).toBeDefined();
		expect(rich?.['a:uFillTx']).toBeDefined();
		expect(rich?.['a:ln']).toStrictEqual({ 'a:noFill': '' });
		expect(rich?.['a:solidFill']).toStrictEqual({ 'a:prstClr': { '@_val': 'white' } });
		expect(rich?.['a:latin']).toStrictEqual({
			'@_typeface': 'Calibri',
			'@_panose': '020F0502020204030204',
		});
	});
});
