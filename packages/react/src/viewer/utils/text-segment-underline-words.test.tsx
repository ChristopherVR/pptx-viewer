/**
 * D2-G3: `a:rPr/@u="words"` underlines only the non-whitespace characters of
 * a run, leaving inter-word spaces unmarked - distinct from `sng`, which
 * underlines the whole run including its spaces.
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

function markupOf(style: TextStyle, text: string): string {
	const segment: TextSegment = { text, style };
	// `buildParagraphs` (shared) already splits a `u="words"` run into word and
	// gap pieces so every binding gets the gap; render the whole paragraph so the
	// markup reflects what a slide actually shows, not just the first piece.
	const runs = buildParagraphs({ ...element, textSegments: [segment] } as PptxElement)[0].runs;
	return renderToStaticMarkup(
		<>
			{runs.map((run) => renderParagraphRun(run, segment, { element, fallbackColor: '#000000' }))}
		</>,
	);
}

describe('u="words" underline (D2-G3)', () => {
	it('does not underline the run through a continuous decoration', () => {
		// The whole point of the gap: a plain `text-decoration:underline` on the
		// outer run span would draw straight through the space regardless of what
		// any inner span declares, so the outer span itself must not carry it.
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'Two Words');
		const outerSpanStyle = markup.match(/<span[^>]*data-seg-idx[^>]*style="([^"]*)"/u)?.[1] ?? '';
		expect(outerSpanStyle).not.toContain('text-decoration');
	});

	it('wraps each word in its own underlined span', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'Two Words');
		const wordSpans = [...markup.matchAll(/<span style="([^"]*text-decoration:underline[^"]*)"/gu)];
		expect(wordSpans).toHaveLength(2);
	});

	it('leaves the whitespace between words undecorated', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'Two Words');
		// The space renders as plain text (or a span with no decoration), never
		// wrapped in an underlined span of its own.
		expect(markup).not.toMatch(/<span style="[^"]*text-decoration:underline[^"]*"[^>]*> <\/span>/u);
	});

	it('still underlines the whole run when u="sng" (regression, not "words")', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'sng' }, 'Two Words');
		const outerSpanStyle = markup.match(/<span[^>]*data-seg-idx[^>]*style="([^"]*)"/u)?.[1] ?? '';
		// `sng` keeps the continuous underline on the run's own span - only
		// `words` splits it into per-word pieces.
		expect(outerSpanStyle).toContain('text-decoration:underline');
	});

	it('renders a single word with no whitespace as one still-underlined span (no DOM blow-up)', () => {
		const markup = markupOf({ underline: true, underlineStyle: 'words' }, 'Word');
		// The outer run span never carries the decoration once `u="words"`
		// applies (see the first test above); the single word piece's own inner
		// span carries it instead - one extra span, not a whole new pipeline.
		expect(markup.match(/text-decoration:underline/gu)).toHaveLength(1);
		expect(markup.match(/<span/gu)?.length).toBe(2);
	});
});
