/**
 * The run's decoration has to survive React's per-word metric split.
 *
 * React renders one span per run and nests a span per WORD inside it, each
 * carrying the tracking that makes the line measure what PowerPoint measured
 * (issue #149). `text-decoration-*` does not inherit - CSS draws an ancestor's
 * underline through its inline descendants, but each descendant still computes
 * `none` of its own - so the element that directly parents the text declared no
 * decoration at all. That is what `text-layout-parity.spec.ts` reads, and it is
 * why React alone reported `text-decoration-line: none` on the hyperlinked run
 * of `text-layout.pptx` where the other four bindings reported `underline`:
 * they clone the whole run style onto every piece (shared `splitStyledRun`).
 *
 * The split needs a canvas to measure with, and there is none under vitest's
 * node environment, so `splitRunForMetrics` is stood in for here. Everything
 * else - `buildParagraphs`, `renderParagraphRun`, the real run style - is the
 * production path.
 */
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		// One piece per word, exactly as the canvas-backed splitter emits them.
		splitRunForMetrics: (text: string) =>
			text
				.split(/(?<=\s)/u)
				.filter(Boolean)
				.map((piece) => ({ text: piece, tracking: 0.01 })),
	};
});

const { buildParagraphs } = await import('pptx-viewer-shared');
const { renderParagraphRun } = await import('./text-segment-render');

const element = {
	id: 'ppt/slides/slide1.xml-shape-4',
	type: 'text',
	x: 0,
	y: 0,
	width: 400,
	height: 100,
	textStyle: { fontSize: 18 },
} as unknown as PptxElement & Partial<{ textStyle: TextStyle }>;

/** Render one run through the real pipeline and return its markup. */
function markupOf(style: TextStyle, text: string): string {
	const segment: TextSegment = { text, style };
	const run = buildParagraphs({ ...element, textSegments: [segment] } as PptxElement)[0].runs[0];
	return renderToStaticMarkup(
		<>{renderParagraphRun(run, segment, { element, fallbackColor: '#000000' })}</>,
	);
}

/** The per-word piece spans, identified by the tracking they carry. */
function pieceSpans(markup: string): string[] {
	return [...markup.matchAll(/<span style="([^"]*letter-spacing[^"]*)"/gu)].map((m) => m[1]);
}

describe('per-word metric pieces keep the run decoration', () => {
	it('underlines every piece of a hyperlinked run', () => {
		// PowerPoint underlines a hyperlink by default; shared puts that on the
		// run style, which React used to leave on the span the reader never sees.
		const pieces = pieceSpans(markupOf({ hyperlink: 'https://example.com/docs' }, 'the docs'));
		expect(pieces).toHaveLength(2);
		for (const piece of pieces) {
			expect(piece).toContain('text-decoration:underline');
		}
	});

	it('carries an authored underline and its variant onto every piece', () => {
		const pieces = pieceSpans(
			markupOf({ underline: true, underlineStyle: 'dbl' }, 'two more words'),
		);
		expect(pieces).toHaveLength(3);
		for (const piece of pieces) {
			expect(piece).toContain('text-decoration:underline');
			expect(piece).toContain('text-decoration-style:double');
		}
	});

	it('leaves the pieces of an undecorated run bare', () => {
		const markup = markupOf({ fontSize: 18 }, 'plain prose here');
		expect(pieceSpans(markup)).toHaveLength(3);
		expect(markup).not.toContain('text-decoration');
	});
});
