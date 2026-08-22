import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderParagraphRun } from './text-segment-render';

/**
 * Measured tab-stop layout (`text-tab-layout.ts` / `text-tab-run-build.ts` in
 * `pptx-viewer-shared`) was extracted from this file's former private
 * implementation. React now renders through the same shared descriptor as the
 * other four bindings; this proves the end-to-end pipeline (`buildParagraphs`
 * -> `renderParagraphRun`) still lines up a TOC-style row with a dot leader
 * and a right-aligned page number.
 */
function segment(style: Record<string, unknown>, text: string): TextSegment {
	return { text, style } as TextSegment;
}

const baseElement = {
	id: 'ppt/slides/slide1.xml-shape-1',
	type: 'text',
	x: 0,
	y: 0,
	width: 400,
	height: 100,
} as unknown as PptxElement;

function render(
	textStyle: Partial<TextStyle>,
	runStyle: Record<string, unknown>,
	text: string,
): string {
	const seg = segment(runStyle, text);
	const element = { ...baseElement, textStyle } as PptxElement & { textStyle: TextStyle };
	const run = buildParagraphs({ ...element, textSegments: [seg] } as PptxElement)[0].runs[0];
	return renderToStaticMarkup(
		<>{renderParagraphRun(run, seg, { element, fallbackColor: '#000000' })}</>,
	);
}

describe('renderParagraphRun - measured tab-stop layout', () => {
	it('renders a leader-filled span for a dot-leader right tab', () => {
		const markup = render(
			{ tabStops: [{ position: 300, align: 'r', leader: 'dot' }] },
			{ fontFamily: 'Arial', fontSize: 16 },
			'Introduction\t12',
		);
		expect(markup).toContain('Introduction');
		expect(markup).toContain('12');
		expect(markup).toContain('aria-hidden');
	});

	it('leaves a run with no tab character on the plain text path', () => {
		const markup = render(
			{ tabStops: [{ position: 300, align: 'r', leader: 'dot' }] },
			{ fontFamily: 'Arial', fontSize: 16 },
			'No tabs here',
		);
		expect(markup).not.toContain('aria-hidden');
		expect(markup).toContain('No tabs here');
	});

	it('leaves a tab character alone when the body authors no tab stops', () => {
		// A plain CSS `tab-size` (set at the block level) handles this case, so
		// the measured layout must not fire without explicit `a:tabLst` stops.
		const markup = render({}, { fontFamily: 'Arial', fontSize: 16 }, 'Label\tValue');
		expect(markup).not.toContain('aria-hidden');
	});
});
