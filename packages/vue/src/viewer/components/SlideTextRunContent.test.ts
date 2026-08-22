import { mount } from '@vue/test-utils';
import type { PptxElement, TextSegment, TextStyle } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import SlideTextBlock from './SlideTextBlock.vue';

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
 * issue: per-script font fallback (`a:ea`/`a:cs`/`a:sym`) was React-only. Vue
 * rendered the whole run in the `a:latin` face, so CJK text painted in the
 * browser's default serif instead of the deck's own east-Asian typeface.
 */
describe('slideTextBlock - per-script font fallback', () => {
	it('renders mixed latin/CJK text in the correct typeface per script', () => {
		const seg: TextSegment = {
			text: 'Mixed 中文 text',
			style: { fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const wrapper = mount(SlideTextBlock, { props: { paragraphs, textStyle: {} } });
		const cjkSpan = wrapper
			.findAll('span')
			.find((s) => (s.attributes('style') ?? '').includes('SimSun'));
		expect(cjkSpan).toBeDefined();
		expect(cjkSpan?.text()).toContain('中文');
	});

	it('renders pure-latin text with no extra per-script span', () => {
		const seg: TextSegment = {
			text: 'Hello world',
			style: { fontFamily: 'Arial', eastAsiaFont: 'SimSun' },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const wrapper = mount(SlideTextBlock, { props: { paragraphs, textStyle: {} } });
		expect(wrapper.text()).toContain('Hello world');
		expect(wrapper.html()).not.toContain('SimSun');
	});
});

/**
 * issue: measured tab-stop layout (per-stop alignment + leader glyphs) was
 * React-only. Vue fell back to a plain CSS `tab-size`, so a TOC row lost its
 * dot leader and right-aligned page number.
 */
describe('slideTextBlock - measured tab-stop layout', () => {
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

		const wrapper = mount(SlideTextBlock, { props: { paragraphs, textStyle: {} } });
		expect(wrapper.text()).toContain('Introduction');
		expect(wrapper.text()).toContain('12');
		expect(wrapper.html()).toContain('aria-hidden');
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
