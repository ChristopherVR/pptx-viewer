/**
 * `a:rPr/@u="words"` is specified as "underline words only", but PowerPoint
 * draws it continuously, gaps included, exactly like `sng` (COM-verified in
 * the 2026-09 limitations wave; see `splitsUnderlineIntoWords` in shared).
 * These pin React to that: the run keeps one continuous underline.
 *
 * As in `text-segment-decoration.test.tsx`, `splitRunForMetrics` is stood in
 * for since there is no canvas under vitest; everything else - `buildParagraphs`,
 * `renderParagraphRun`, the real run style - is the production path.
 */
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		splitRunForMetrics: (text: string) =>
			text
				.split(/(?<=\s)/u)
				.filter(Boolean)
				.map((piece) => ({ text: piece, tracking: 0 })),
	};
});

const { buildParagraphs } = await import('pptx-viewer-shared');
const { renderParagraphRun } = await import('./text-segment-render');

const element = {
	id: 'ppt/slides/slide1.xml-shape-9',
	type: 'text',
	x: 0,
	y: 0,
	width: 400,
	height: 100,
	textStyle: { fontSize: 18 },
} as unknown as PptxElement & Partial<{ textStyle: TextStyle }>;

function markupOf(
	style: TextStyle,
	text: string,
	extra: Partial<TextSegment> = {},
	textStyle: TextStyle = element.textStyle ?? {},
): string {
	const segment: TextSegment = { text, style, ...extra };
	const host = { ...element, textStyle, textSegments: [segment] } as PptxElement &
		Partial<{ textStyle: TextStyle }>;
	// `buildParagraphs` (shared) already splits a `u="words"` run into word and
	// gap pieces so every binding gets the gap; render the whole paragraph so the
	// markup reflects what a slide actually shows, not just the first piece.
	const runs = buildParagraphs(host)[0].runs;
	return renderToStaticMarkup(
		<>
			{runs.map((run) =>
				renderParagraphRun(run, segment, { element: host, fallbackColor: '#000000' }),
			)}
		</>,
	);
}

/** Every `<span ...>` whose own inline style declares an underline. */
function underlinedSpans(markup: string): string[] {
	return [...markup.matchAll(/<span[^>]*style="[^"]*text-decoration:underline[^"]*"[^>]*>/gu)].map(
		(m) => m[0],
	);
}

/** Text of every leaf `<span>` (one with text and no child tag) that lacks an underline. */
function undecoratedLeaves(markup: string): string[] {
	return [...markup.matchAll(/<span( style="[^"]*")?>([^<]+)<\/span>/gu)]
		.filter((m) => !(m[1] ?? '').includes('text-decoration:underline'))
		.map((m) => m[2]);
}

describe('u="words" underline renders like PowerPoint (continuous)', () => {
	it('underlines the run continuously, through the gap', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'Two Words');
		const outerSpanStyle = markup.match(/<span[^>]*data-seg-idx[^>]*style="([^"]*)"/u)?.[1] ?? '';
		expect(outerSpanStyle).toContain('text-decoration:underline');
		// No whitespace-only piece is left undecorated inside the run.
		expect(markup).not.toMatch(/<span style="(?![^"]*text-decoration:underline)[^"]*"> <\/span>/u);
	});

	it('draws the underline through descenders (no ink skipping)', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'gypsy');
		expect(markup).toContain('text-decoration-skip-ink:none');
	});

	it('renders the same as u="sng"', () => {
		const words = markupOf({ underline: true, underlineStyle: 'words' }, 'Two Words');
		const sng = markupOf({ underline: true, underlineStyle: 'sng' }, 'Two Words');
		expect(underlinedSpans(words)).toHaveLength(underlinedSpans(sng).length);
	});

	it('keeps a ruby base text as one underlined run', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'ALFA BETO', {
			rubyText: 'reading',
		});
		expect(markup).toContain('<ruby>');
		const outerSpanStyle = markup.match(/<span[^>]*data-seg-idx[^>]*style="([^"]*)"/u)?.[1] ?? '';
		expect(outerSpanStyle).toContain('text-decoration:underline');
		// Every leaf text piece (words and the space riding on "ALFA ") repeats the underline.
		expect(undecoratedLeaves(markup)).toStrictEqual([]);
	});

	it('keeps a tab-separated piece as one continuously underlined span', () => {
		const markup = markupOf(
			{ underline: true, underlineStyle: 'words' },
			'GAMA DELTO\tEPSILON',
			{},
			{ fontSize: 18, tabStops: [{ position: 300, align: 'l' }] },
		);
		expect(
			markup.match(/<span style="text-decoration:underline[^"]*display:inline-block/gu),
		).toHaveLength(2);
		expect(undecoratedLeaves(markup)).toStrictEqual([]);
	});
});
