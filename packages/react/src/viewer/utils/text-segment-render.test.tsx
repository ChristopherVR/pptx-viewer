import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import type React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderParagraphRun } from './text-segment-render';

function makeElement(): PptxElement & Partial<{ textStyle: TextStyle }> {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 100,
		height: 40,
		textStyle: { fontSize: 20 },
	} as unknown as PptxElement & Partial<{ textStyle: TextStyle }>;
}

/**
 * Render one run the way the paragraph renderer does - shared builds the run's
 * CSS, React layers its own resolution on top - and return the span's style.
 */
function styleOf(style: TextStyle, text = 'Hello'): React.CSSProperties {
	const segment: TextSegment = { text, style };
	const element = makeElement();
	const run = buildParagraphs({ ...element, textSegments: [segment] } as PptxElement)[0].runs[0];
	const node = renderParagraphRun(run, segment, {
		element,
		fallbackColor: '#000000',
	}) as React.ReactElement<{ style: React.CSSProperties }>;
	return node.props.style;
}

/** The run's rendered markup, spans and all (React splits a run internally). */
function markupOf(style: TextStyle, text: string): string {
	const segment: TextSegment = { text, style };
	const element = makeElement();
	const run = buildParagraphs({ ...element, textSegments: [segment] } as PptxElement)[0].runs[0];
	return renderToStaticMarkup(
		<>{renderParagraphRun(run, segment, { element, fallbackColor: '#000000' })}</>,
	);
}

describe('renderParagraphRun - text capitalization (a:rPr/@cap)', () => {
	it('maps cap="all" to text-transform: uppercase', () => {
		const style = styleOf({ textCaps: 'all' });
		expect(style.textTransform).toBe('uppercase');
		expect(style.fontVariantCaps).toBeUndefined();
	});

	it('maps cap="small" to font-variant-caps: small-caps', () => {
		const style = styleOf({ textCaps: 'small' });
		expect(style.fontVariantCaps).toBe('small-caps');
		expect(style.textTransform).toBeUndefined();
	});

	it('leaves capitalization unset for cap="none"', () => {
		const style = styleOf({ textCaps: 'none' });
		expect(style.textTransform).toBeUndefined();
		expect(style.fontVariantCaps).toBeUndefined();
	});
});

describe('renderParagraphRun - baseline shift (a:rPr/@baseline)', () => {
	it('honours the authored percentage magnitude (thousandths-of-percent)', () => {
		// 30000 = 30% of a 20px font -> 6px raise.
		const style = styleOf({ baseline: 30000, fontSize: 20 });
		expect(style.verticalAlign).toBe('6px');
	});

	it('lowers the baseline for a negative (subscript) shift', () => {
		// -25000 = -25% of 20px -> -5px.
		const style = styleOf({ baseline: -25000, fontSize: 20 });
		expect(style.verticalAlign).toBe('-5px');
	});

	it('supports a bare-percent authored value', () => {
		// 30 (bare percent) of 20px -> 6px.
		const style = styleOf({ baseline: 30, fontSize: 20 });
		expect(style.verticalAlign).toBe('6px');
	});

	it('scales the font down for shifted text', () => {
		const style = styleOf({ baseline: 30000, fontSize: 20 });
		expect(style.fontSize).toBe(13); // 20 * 0.65
	});

	it('leaves the baseline unset when no shift is authored', () => {
		const style = styleOf({ fontSize: 20 });
		expect(style.verticalAlign).toBeUndefined();
		expect(style.fontSize).toBe(20);
	});
});

describe('renderParagraphRun - hollow text (a:rPr > a:noFill)', () => {
	// `line-fill-parity.spec.ts` compares this run across the five bindings, and
	// React was the outlier: it spread shared's run style (which sets both
	// `color` and `-webkit-text-fill-color` to transparent) and then put the
	// inherited colour straight back on `color`, painting a blue glyph with a
	// transparent fill instead of a hollow one.
	it('clears the glyph interior instead of repainting the inherited colour', () => {
		const style = styleOf({
			color: '#0000FF',
			textFillNone: true,
			textOutlineWidth: 2,
			textOutlineColor: '#C00000',
		});
		expect(style.color).toBe('transparent');
		expect(style.WebkitTextFillColor).toBe('transparent');
		// The authored outline still draws the letterform.
		expect(style.WebkitTextStroke).toBe('2px #C00000');
	});

	it('pins an uncoloured outline to the colour React resolved for the run', () => {
		// `currentColor` would be erased by the transparent fallback, taking the
		// letterform with it, so the stroke has to name the resolved colour.
		const style = styleOf({ color: '#0000FF', textFillNone: true, textOutlineWidth: 3 });
		expect(style.WebkitTextStroke).toBe('3px #0000FF');
	});

	it('leaves an ordinary run painting its resolved colour', () => {
		const style = styleOf({ color: '#0000FF', textOutlineWidth: 2, textOutlineColor: '#C00000' });
		expect(style.color).toBe('#0000FF');
		expect(style.WebkitTextFillColor).toBeUndefined();
	});
});

describe('renderParagraphRun - decoration on the spans nested inside a run', () => {
	// `text-layout-parity.spec.ts` reads `text-decoration-line` off the element
	// that directly parents each text node. React nests per-script font spans
	// (and, where a canvas can measure them, per-word metric pieces) inside the
	// run span, and `text-decoration-*` does not inherit, so every one of those
	// reported `none` while the other four bindings - which clone the whole run
	// style onto each piece - reported `underline`.
	// The per-word split needs a canvas and so is covered in
	// `text-segment-decoration.test.tsx`, which stands one in.
	it('repeats the underline on each per-script font span', () => {
		const markup = markupOf(
			{ underline: true, fontSize: 20, fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
			'Mixed 中文 text',
		);
		const inner = [...markup.matchAll(/<span style="([^"]*font-family[^"]*)"/gu)];
		expect(inner.length).toBeGreaterThan(0);
		for (const span of inner) {
			expect(span[1]).toContain('text-decoration:underline');
		}
	});

	it('adds nothing to the spans of an undecorated run', () => {
		const markup = markupOf(
			{ fontSize: 20, fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
			'Mixed 中文 text',
		);
		expect(markup).not.toContain('text-decoration');
	});
});

describe('renderParagraphRun - kerning threshold (a:rPr/@kern)', () => {
	it('disables kerning when kern=0', () => {
		const style = styleOf({ kerning: 0, fontSize: 20 });
		expect(style.fontKerning).toBe('none');
	});

	it('enables kerning when the font meets the threshold', () => {
		// kern=1200 -> 12pt threshold; 20px = 15pt >= 12pt.
		const style = styleOf({ kerning: 1200, fontSize: 20 });
		expect(style.fontKerning).toBe('normal');
	});

	it('disables kerning below the threshold', () => {
		// kern=2400 -> 24pt threshold; 20px = 15pt < 24pt.
		const style = styleOf({ kerning: 2400, fontSize: 20 });
		expect(style.fontKerning).toBe('none');
	});

	it('leaves kerning unset when not authored', () => {
		const style = styleOf({ fontSize: 20 });
		expect(style.fontKerning).toBeUndefined();
	});
});
