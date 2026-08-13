import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { describe, it, expect } from 'vitest';

import {
	resolveParagraphRtl,
	resolveParagraphAlign,
	resolveCssTextAlign,
	renderTextSegments,
} from './text-paragraph-render';
import { renderParagraphRun } from './text-segment-render';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a minimal paragraph entry for the shared direction/align resolvers. */
function makeParagraphEntry(style: TextStyle, text = 'test'): { segment: TextSegment } {
	return { segment: { text, style } };
}

/** Create a minimal text element with given textStyle overrides. */
function makeTextElement(
	textStyleOverrides: Record<string, unknown> = {},
	extras: Record<string, unknown> = {},
): PptxElement {
	return {
		id: 'el-bidi',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 200,
		text: 'Hello',
		textStyle: { ...textStyleOverrides },
		...extras,
	} as unknown as PptxElement;
}

// =======================================================================
// 1. resolveParagraphRtl
// =======================================================================

describe('resolveParagraphRtl', () => {
	it('returns segment-level RTL when a segment explicitly sets rtl=true', () => {
		const entries = [makeParagraphEntry({ rtl: true })];
		expect(resolveParagraphRtl(entries, undefined)).toBeTruthy();
	});

	it('returns segment-level LTR when a segment explicitly sets rtl=false', () => {
		const entries = [makeParagraphEntry({ rtl: false })];
		expect(resolveParagraphRtl(entries, undefined)).toBeFalsy();
	});

	it('falls back to element-level RTL when no segment sets direction', () => {
		const entries = [makeParagraphEntry({})];
		expect(resolveParagraphRtl(entries, true)).toBeTruthy();
	});

	it('returns undefined when neither segments nor element set direction', () => {
		const entries = [makeParagraphEntry({})];
		expect(resolveParagraphRtl(entries, undefined)).toBeUndefined();
	});

	it("uses the first segment's direction when multiple segments differ", () => {
		const entries = [makeParagraphEntry({ rtl: true }), makeParagraphEntry({ rtl: false })];
		expect(resolveParagraphRtl(entries, undefined)).toBeTruthy();
	});
});

// =======================================================================
// 2. resolveParagraphAlign
// =======================================================================

describe('resolveParagraphAlign', () => {
	it('returns segment-level alignment when present', () => {
		const entries = [makeParagraphEntry({ align: 'center' })];
		expect(resolveParagraphAlign(entries, undefined)).toBe('center');
	});

	it('falls back to element-level alignment', () => {
		const entries = [makeParagraphEntry({})];
		expect(resolveParagraphAlign(entries, 'right')).toBe('right');
	});

	it('returns undefined when no alignment is set anywhere', () => {
		const entries = [makeParagraphEntry({})];
		expect(resolveParagraphAlign(entries, undefined)).toBeUndefined();
	});
});

// =======================================================================
// 3. resolveCssTextAlign
// =======================================================================

describe('resolveCssTextAlign', () => {
	it("returns 'right' for RTL paragraph with no explicit alignment", () => {
		expect(resolveCssTextAlign(undefined, true)).toBe('right');
	});

	it('returns undefined for LTR paragraph with no explicit alignment', () => {
		expect(resolveCssTextAlign(undefined, false)).toBeUndefined();
	});

	it("respects explicit 'center' alignment in RTL paragraph", () => {
		expect(resolveCssTextAlign('center', true)).toBe('center');
	});

	it("respects explicit 'left' alignment in RTL paragraph (override)", () => {
		expect(resolveCssTextAlign('left', true)).toBe('left');
	});

	it("maps 'justLow' to 'justify'", () => {
		expect(resolveCssTextAlign('justLow', false)).toBe('justify');
	});

	it("maps 'dist' to 'justify'", () => {
		expect(resolveCssTextAlign('dist', true)).toBe('justify');
	});

	it("maps 'thaiDist' to 'justify'", () => {
		expect(resolveCssTextAlign('thaiDist', false)).toBe('justify');
	});

	it("returns 'justify' for explicit justify alignment", () => {
		expect(resolveCssTextAlign('justify', false)).toBe('justify');
	});
});

// =======================================================================
// 4. renderTextSegments: paragraph-level BiDi
// =======================================================================

describe('renderTextSegments: paragraph-level BiDi', () => {
	it('sets direction:rtl and textAlign:right on a pure RTL paragraph', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true } }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		expect(result).toBeDefined();
		expect(result.length).toBeGreaterThan(0);
		// Should render as a <div> wrapper because of RTL
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('right');
		expect(para.props.style.unicodeBidi).toBe('embed');
	});

	it('sets direction:ltr on a pure LTR paragraph with explicit rtl=false', () => {
		const el = makeTextElement(
			{ rtl: false },
			{
				textSegments: [{ text: 'Hello', style: { rtl: false } }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('ltr');
		expect(para.props.style.unicodeBidi).toBe('embed');
	});

	it('does not set direction when no RTL flag is present', () => {
		const el = makeTextElement(
			{},
			{
				textSegments: [{ text: 'Hello', style: {} }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		// Without RTL or other triggers, should use Fragment (no wrapper div)
		const para = result[0] as React.ReactElement;
		// React.Fragment doesn't have style props
		expect(para.props.style).toBeUndefined();
	});

	it('swaps marginLeft to marginRight for RTL paragraph with indent', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true } }],
				paragraphIndents: [{ level: 0, marginLeft: 30, indent: -10 }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.marginRight).toBe(30);
		expect(para.props.style.marginLeft).toBeUndefined();
	});

	it('keeps marginLeft for LTR paragraph with indent', () => {
		const el = makeTextElement(
			{ rtl: false },
			{
				textSegments: [{ text: 'Hello', style: { rtl: false } }],
				paragraphIndents: [{ level: 0, marginLeft: 30, indent: -10 }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.marginLeft).toBe(30);
		expect(para.props.style.marginRight).toBeUndefined();
	});

	it('applies explicit center alignment to RTL paragraph', () => {
		const el = makeTextElement(
			{ rtl: true, align: 'center' },
			{
				textSegments: [
					{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true, align: 'center' } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('center');
	});
});

// =======================================================================
// 5. renderParagraphRun: run-level BiDi
// =======================================================================

/**
 * Render one run the way the paragraph renderer does: the run's CSS comes from
 * shared, the BiDi override is React's own layer on top of it.
 */
function runNode(
	style: TextStyle,
	text: string,
	paragraphRtl: boolean | undefined,
): React.ReactElement {
	const segment: TextSegment = { text, style };
	const element = makeTextElement({});
	const run = buildParagraphs({ ...element, textSegments: [segment] } as PptxElement)[0].runs[0];
	return renderParagraphRun(run, segment, {
		element,
		fallbackColor: '#000000',
		paragraphRtl,
	}) as React.ReactElement;
}

describe('renderParagraphRun: run-level BiDi override', () => {
	it('applies bidi-override when run direction differs from paragraph (LTR run in RTL para)', () => {
		const result = runNode({ rtl: false }, 'Hello', true);
		expect(result.props.style.direction).toBe('ltr');
		expect(result.props.style.unicodeBidi).toBe('bidi-override');
	});

	it('applies bidi-override when run direction differs from paragraph (RTL run in LTR para)', () => {
		const result = runNode({ rtl: true }, 'مرحبا', false);
		expect(result.props.style.direction).toBe('rtl');
		expect(result.props.style.unicodeBidi).toBe('bidi-override');
	});

	it('applies embed when run direction matches paragraph direction', () => {
		const result = runNode({ rtl: true }, 'مرحبا', true);
		expect(result.props.style.direction).toBe('rtl');
		expect(result.props.style.unicodeBidi).toBe('embed');
	});

	it('does not set BiDi properties when run has no explicit direction', () => {
		const result = runNode({}, 'neutral', true);
		expect(result.props.style.direction).toBeUndefined();
		expect(result.props.style.unicodeBidi).toBeUndefined();
	});
});

// =======================================================================
// 6. Mixed RTL/LTR runs in a paragraph
// =======================================================================

describe('renderTextSegments: mixed RTL/LTR runs', () => {
	it('renders mixed RTL and LTR runs in an RTL paragraph', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [
					{ text: '\u0645\u0631\u062D\u0628\u0627 ', style: { rtl: true } },
					{ text: 'OpenAI', style: { rtl: false } },
					{ text: ' \u0639\u0627\u0644\u0645', style: { rtl: true } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		// Should be a single paragraph div
		expect(result).toHaveLength(1);
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('right');
	});

	it('renders mixed LTR and RTL runs in an LTR paragraph', () => {
		const el = makeTextElement(
			{ rtl: false },
			{
				textSegments: [
					{ text: 'Hello ', style: { rtl: false } },
					{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true } },
					{ text: ' world', style: { rtl: false } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('ltr');
	});
});

// =======================================================================
// 7. Embedded numbers in RTL text
// =======================================================================

describe('renderTextSegments: embedded numbers in RTL text', () => {
	it('uses embed unicode-bidi for RTL paragraph (numbers render LTR naturally)', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [
					{ text: '\u0627\u0644\u0631\u0642\u0645 123 \u0647\u0646\u0627', style: { rtl: true } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		// `embed` allows the Unicode Bidi Algorithm to handle numbers correctly:
		// numbers are inherently LTR and will render left-to-right within the RTL context
		expect(para.props.style.unicodeBidi).toBe('embed');
		expect(para.props.style.direction).toBe('rtl');
	});

	it('run-level embed reinforces number rendering in explicitly RTL runs', () => {
		const result = runNode({ rtl: true }, '\u0633\u0639\u0631 42.5$', true);
		// Run matches paragraph direction -> embed
		expect(result.props.style.unicodeBidi).toBe('embed');
	});
});

// =======================================================================
// 8. RTL bullet alignment
// =======================================================================

describe('bullet alignment in RTL paragraphs', () => {
	it('uses marginInlineEnd on a picture bullet image, never marginRight', () => {
		// The marker markup is the paragraph renderer's now, built from shared's
		// resolved `bulletPicture`; a logical margin keeps it on the correct side
		// in both directions. (`renderPictureBullet` was React's private copy of
		// this and is gone.)
		const el = makeTextElement(
			{},
			{
				textSegments: [
					{
						text: '• Item',
						style: {},
						bulletInfo: { char: '•', imageDataUrl: 'data:image/png;base64,iVBOR' },
					},
				],
			},
		);
		const para = (renderTextSegments(el, '#000') as React.ReactElement[])[0];
		const marker = (para.props.children as React.ReactElement[])[0];
		expect(marker.type).toBe('img');
		expect(marker.props.style.marginInlineEnd).toBe(4);
		expect(marker.props.style.marginRight).toBeUndefined();
	});

	it('renders an RTL paragraph with a bullet and correct margin direction', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [
					{
						text: '\u2022 \u0645\u0631\u062D\u0628\u0627',
						style: { rtl: true },
						bulletInfo: { char: '\u2022' },
					},
				],
				paragraphIndents: [{ level: 0, marginLeft: 20, indent: -10 }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		// RTL paragraph should swap margin to right
		expect(para.props.style.marginRight).toBe(20);
		expect(para.props.style.marginLeft).toBeUndefined();
		expect(para.props.style.direction).toBe('rtl');
	});
});

// =======================================================================
// 9. Nested BiDi: multiple paragraphs with different directions
// =======================================================================

describe('renderTextSegments: nested/multi-paragraph BiDi', () => {
	it('renders paragraphs with alternating directions', () => {
		const el = makeTextElement(
			{},
			{
				textSegments: [
					{ text: 'English paragraph', style: { rtl: false } },
					{ text: '\n', style: {} },
					{ text: '\u0641\u0642\u0631\u0629 \u0639\u0631\u0628\u064A\u0629', style: { rtl: true } },
					{ text: '\n', style: {} },
					{ text: 'Back to English', style: { rtl: false } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		expect(result).toHaveLength(3);

		// First paragraph: LTR
		const para1 = result[0] as React.ReactElement;
		expect(para1.props.style.direction).toBe('ltr');

		// Second paragraph: RTL
		const para2 = result[1] as React.ReactElement;
		expect(para2.props.style.direction).toBe('rtl');
		expect(para2.props.style.textAlign).toBe('right');

		// Third paragraph: LTR
		const para3 = result[2] as React.ReactElement;
		expect(para3.props.style.direction).toBe('ltr');
	});

	it('inherits element-level RTL when paragraph segments have no explicit direction', () => {
		const el = makeTextElement(
			{ rtl: true },
			{
				textSegments: [{ text: '\u0645\u0631\u062D\u0628\u0627', style: {} }],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('right');
	});
});

// =======================================================================
// 10. RTL paragraph with explicit left alignment (override)
// =======================================================================

describe('rTL paragraph alignment overrides', () => {
	it('allows explicit left alignment in an RTL paragraph', () => {
		const el = makeTextElement(
			{ rtl: true, align: 'left' },
			{
				textSegments: [
					{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true, align: 'left' } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('left');
	});

	it('applies justify alignment to RTL paragraph', () => {
		const el = makeTextElement(
			{ rtl: true, align: 'justify' },
			{
				textSegments: [
					{ text: '\u0645\u0631\u062D\u0628\u0627', style: { rtl: true, align: 'justify' } },
				],
			},
		);
		const result = renderTextSegments(el, '#000') as React.ReactElement[];
		const para = result[0] as React.ReactElement;
		expect(para.props.style.direction).toBe('rtl');
		expect(para.props.style.textAlign).toBe('justify');
	});
});
