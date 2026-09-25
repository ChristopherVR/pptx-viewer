/**
 * `a:pPr/@hangingPunct` and `@eaLnBrk="0"` in React. The other four bindings
 * receive shared `text-east-asian-breaks` pieces as sibling runs; React
 * re-joins each segment into one span and rebuilds the pieces inside it
 * (`text-metric-pieces.tsx`), so this pins the rebuilt markup: the hanging
 * mark is a zero-size inline block glued by a word joiner, followed by the
 * space that carries its advance; kinsoku off inserts zero width spaces.
 */
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { renderTextSegments } from './text-paragraph-render';

function markup(text: string, paragraph: TextSegment['paragraphProperties']): string {
	const segment: TextSegment = {
		text,
		style: { fontSize: 20 },
		paragraphProperties: paragraph,
	};
	const element = {
		id: 'ppt/slides/slide1.xml-shape-3',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		textStyle: { fontSize: 20 } satisfies TextStyle,
		textSegments: [segment],
	} as unknown as PptxElement;
	return renderToStaticMarkup(<>{renderTextSegments(element, '#000000')}</>);
}

describe('react East Asian break pieces', () => {
	it('renders a hanging 。 as a zero-size inline block with an advance-carrying space', () => {
		const html = markup('あいう。えお', { hangingPunctuation: true });
		expect(html).toContain('\u2060');
		expect(html).toMatch(/display:inline-block;inline-size:0px[^>]*>。</u);
		expect(html).toMatch(/word-spacing:[\d.]+px[^>]*> </u);
		expect(html.replaceAll(/<[^>]+>/gu, '')).toBe('あいう\u2060。 えお');
	});

	it('leaves Latin text and non-hanging marks alone', () => {
		const html = markup('Hello, world. あ」', { hangingPunctuation: true });
		expect(html).not.toContain('inline-block');
		expect(html).not.toContain('\u2060');
	});

	it('inserts zero width spaces between East Asian characters with eaLnBrk="0"', () => {
		const html = markup('用」ッ', { eaLineBreak: false });
		expect(html.replaceAll(/<[^>]+>/gu, '')).toBe('用\u200B」\u200Bッ');
	});

	it('changes nothing when neither flag is set', () => {
		const html = markup('あいう。えお', {});
		expect(html.replaceAll(/<[^>]+>/gu, '')).toBe('あいう。えお');
	});
});
