import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { renderTextBlock } from './text-block';

function element(overrides: Partial<PptxElement & { textStyle: TextStyle }> = {}): PptxElement {
	return {
		id: 'el-1',
		type: 'text',
		x: 0,
		y: 0,
		width: 400,
		height: 100,
		...overrides,
	} as unknown as PptxElement;
}

/**
 * issue: per-script font fallback (`a:ea`/`a:cs`/`a:sym`) was React-only.
 * Vanilla rendered the whole run in the `a:latin` face, so CJK text painted
 * in the browser's default serif instead of the deck's own east-Asian
 * typeface.
 */
describe('renderTextBlock - per-script font fallback', () => {
	it('renders mixed latin/CJK text in the correct typeface per script', () => {
		const seg: TextSegment = {
			text: 'Mixed 中文 text',
			style: { fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const block = renderTextBlock(document, paragraphs, {});
		const spans = [...block.querySelectorAll('span')];
		const cjkSpan = spans.find((s) => s.style.fontFamily.includes('SimSun'));
		expect(cjkSpan).toBeDefined();
		expect(cjkSpan?.textContent).toContain('中文');
	});

	it('renders pure-latin text with no extra per-script span', () => {
		const seg: TextSegment = {
			text: 'Hello world',
			style: { fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const block = renderTextBlock(document, paragraphs, {});
		expect(block.textContent).toContain('Hello world');
		expect(block.innerHTML).not.toContain('SimSun');
	});
});

/**
 * issue: measured tab-stop layout (per-stop alignment + leader glyphs) was
 * React-only. Vanilla fell back to a plain CSS `tab-size`, so a TOC row lost
 * its dot leader and right-aligned page number.
 */
describe('renderTextBlock - measured tab-stop layout', () => {
	it('renders a leader-filled span for a dot-leader right tab', () => {
		const seg: TextSegment = {
			text: 'Introduction\t12',
			style: { fontFamily: 'Arial', fontSize: 16 },
		} as TextSegment;
		const el = {
			...element({ textStyle: { tabStops: [{ position: 300, align: 'r', leader: 'dot' }] } }),
			textSegments: [seg],
		} as PptxElement;
		const paragraphs = buildParagraphs(el);
		const run = paragraphs[0].runs[0];
		expect(run.tabLines).toBeDefined();
		expect(run.tabLines?.[0].pieces).toHaveLength(2);
		expect(run.tabLines?.[0].pieces[1].leaderText).toMatch(/^\.+$/u);

		const block = renderTextBlock(document, paragraphs, {});
		expect(block.textContent).toContain('Introduction');
		expect(block.textContent).toContain('12');
		expect(block.querySelector('[aria-hidden="true"]')).toBeTruthy();
	});

	it('leaves a run with no tab character on the plain text path', () => {
		const seg: TextSegment = {
			text: 'No tabs here',
			style: { fontFamily: 'Arial', fontSize: 16 },
		} as TextSegment;
		const el = {
			...element({ textStyle: { tabStops: [{ position: 300, align: 'r', leader: 'dot' }] } }),
			textSegments: [seg],
		} as PptxElement;
		const paragraphs = buildParagraphs(el);
		expect(paragraphs[0].runs[0].tabLines).toBeUndefined();
	});
});

/**
 * Cross-browser fix: reflection used to ride `-webkit-box-reflect` on the
 * run's own span, which Firefox never implemented. Shared now attaches a
 * mirrored-sibling wrapper style (`run.reflection`) instead, the same
 * mechanism a shape/picture's `renderReflectionOverlay` uses.
 */
describe('renderTextBlock - reflection (a:rPr/a:effectLst/a:reflection)', () => {
	it('renders a mirrored sibling with no -webkit-box-reflect anywhere', () => {
		const seg: TextSegment = {
			text: 'Reflected',
			style: { fontFamily: 'Arial', fontSize: 20, textReflection: true },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		expect(paragraphs[0].runs[0].reflection).toBeDefined();

		const block = renderTextBlock(document, paragraphs, {});
		expect(block.querySelector('.pptxv-text-reflection')).toBeTruthy();
		expect(block.innerHTML).not.toContain('box-reflect');
		expect(block.innerHTML).not.toContain('WebkitBoxReflect');
	});

	it('adds no reflection markup for a plain run', () => {
		const seg: TextSegment = {
			text: 'Plain',
			style: { fontFamily: 'Arial', fontSize: 20 },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const block = renderTextBlock(document, paragraphs, {});
		expect(block.querySelector('.pptxv-text-reflection')).toBeFalsy();
	});
});
