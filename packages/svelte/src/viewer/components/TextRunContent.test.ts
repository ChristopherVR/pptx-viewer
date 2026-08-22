import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import type { RenderParagraph } from 'pptx-viewer-shared';
import { buildParagraphs } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import TextBlock from './TextBlock.svelte';

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(paragraphs: RenderParagraph[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(TextBlock, { target, props: { paragraphs, textStyle: '' } });
	flushSync();
	return target;
}

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
 * Svelte rendered the whole run in the `a:latin` face, so CJK text painted in
 * the browser's default serif instead of the deck's own east-Asian typeface.
 */
describe('textBlock - per-script font fallback', () => {
	it('renders mixed latin/CJK text in the correct typeface per script', () => {
		const seg: TextSegment = {
			text: 'Mixed 中文 text',
			style: { fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const target = render(paragraphs);
		const spans = [...target.querySelectorAll('span')];
		const cjkSpan = spans.find((s) => (s.getAttribute('style') ?? '').includes('SimSun'));
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
		const target = render(paragraphs);
		expect(target.textContent).toContain('Hello world');
		expect(target.innerHTML).not.toContain('SimSun');
	});
});

/**
 * issue: measured tab-stop layout (per-stop alignment + leader glyphs) was
 * React-only. Svelte fell back to a plain CSS `tab-size`, so a TOC row lost
 * its dot leader and right-aligned page number.
 */
describe('textBlock - measured tab-stop layout', () => {
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

		const target = render(paragraphs);
		expect(target.textContent).toContain('Introduction');
		expect(target.textContent).toContain('12');
		expect(target.innerHTML).toContain('aria-hidden');
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
