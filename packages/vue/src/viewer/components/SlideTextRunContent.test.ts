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

/**
 * Cross-browser fix: reflection used to ride `-webkit-box-reflect` on the
 * run's own span, which Firefox never implemented. Shared now attaches a
 * mirrored-sibling wrapper style (`run.reflection`) instead, the same
 * mechanism a shape/picture's `ShapeEffectOverlay` uses.
 */
describe('slideTextBlock - reflection (a:rPr/a:effectLst/a:reflection)', () => {
	it('renders a mirrored sibling with no -webkit-box-reflect anywhere', () => {
		const seg: TextSegment = {
			text: 'Reflected',
			style: { fontFamily: 'Arial', fontSize: 20, textReflection: true },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		expect(paragraphs[0].runs[0].reflection).toBeDefined();

		const wrapper = mount(SlideTextBlock, { props: { paragraphs, textStyle: {} } });
		const layer = wrapper.get('.pptx-vue-text-reflection');
		expect(layer.attributes('style') ?? '').toContain('position: absolute');
		// The `mask-image` value itself (jsdom's CSSOM does not model that
		// property, so it never round-trips through a mounted style attribute
		// in tests even though real browsers apply it) is covered directly by
		// `pptx-viewer-shared`'s `reflection.test.ts`.
		expect(wrapper.html()).not.toContain('box-reflect');
		expect(wrapper.html()).not.toContain('WebkitBoxReflect');
	});

	it('adds no reflection markup for a plain run', () => {
		const seg: TextSegment = {
			text: 'Plain',
			style: { fontFamily: 'Arial', fontSize: 20 },
		} as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const paragraphs = buildParagraphs(el);
		const wrapper = mount(SlideTextBlock, { props: { paragraphs, textStyle: {} } });
		expect(wrapper.html()).not.toContain('pptx-vue-text-reflection');
	});
});

/**
 * `a:rPr/@u="words"` underlines only the words. The ordinary per-word split
 * already emits sibling runs, but a tab-separated piece and a ruby base text
 * each stay ONE piece, so shared hands the word/gap breakdown over as
 * `piece.words` / `run.underlineWordPieces` and the template renders it.
 */
describe('slideTextBlock - u="words" on tab pieces and ruby runs', () => {
	const wordsStyle = {
		fontFamily: 'Arial',
		fontSize: 16,
		underline: true,
		underlineStyle: 'words',
	};

	it('renders a tab piece as one span per word with no underline under the gap', () => {
		const seg = { text: 'Hello World\t12', style: wordsStyle } as unknown as TextSegment;
		const el = {
			...element({ textStyle: { tabStops: [{ position: 300, align: 'r' }] } }),
			textSegments: [seg],
		} as PptxElement;
		const wrapper = mount(SlideTextBlock, {
			props: { paragraphs: buildParagraphs(el), textStyle: {} },
		});
		const spans = wrapper.findAll('span');
		expect(spans.find((s) => s.text() === 'Hello World')).toBeUndefined();
		const hello = spans.find((s) => s.text() === 'Hello');
		expect(hello?.attributes('style')).toContain('underline');
		expect(hello?.attributes('style')).toContain('inline-block');
		const gap = spans.find((s) => s.element.textContent === ' ');
		expect(gap).toBeDefined();
		expect(gap?.attributes('style') ?? '').not.toContain('underline');
	});

	it('renders a ruby base text word by word, the ruby element itself undecorated', () => {
		const seg = {
			text: 'two words',
			rubyText: 'reading',
			style: wordsStyle,
		} as unknown as TextSegment;
		const el = { ...element(), textSegments: [seg] } as PptxElement;
		const wrapper = mount(SlideTextBlock, {
			props: { paragraphs: buildParagraphs(el), textStyle: {} },
		});
		const ruby = wrapper.get('ruby');
		expect(ruby.attributes('style') ?? '').not.toContain('underline');
		const word = ruby.findAll('span').find((s) => s.text() === 'two');
		expect(word?.attributes('style')).toContain('underline');
		expect(ruby.text()).toContain('two words');
	});
});
