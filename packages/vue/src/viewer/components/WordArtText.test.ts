import { mount } from '@vue/test-utils';
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import WordArtText from './WordArtText.vue';

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

function warpedText(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'wa 1',
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		text: 'Hello',
		textStyle: { textWarpPreset: 'textArchUp', color: '#ff0000', fontSize: 32 },
		...overrides,
	} as PptxElement;
}

describe('wordArtText', () => {
	it('renders an svg with a textPath baseline for a warped element', () => {
		const wrapper = mount(WordArtText, { props: { element: warpedText(), zIndex: 5 } });
		expect(wrapper.find('svg.pptx-vue-wordart').exists()).toBeTruthy();
		expect(wrapper.find('textPath').exists()).toBeTruthy();
		// One defs path per paragraph, id sanitised from the element id ("wa 1" → "wa_1").
		const path = wrapper.find('defs path');
		expect(path.exists()).toBeTruthy();
		expect(path.attributes('id')).toBe('warp-wa_1-0');
		expect(path.attributes('d')?.startsWith('M')).toBeTruthy();
		expect(wrapper.find('textPath').attributes('href')).toBe('#warp-wa_1-0');
	});

	it('applies element-level base font + fill on the <text>', () => {
		const wrapper = mount(WordArtText, { props: { element: warpedText(), zIndex: 0 } });
		const text = wrapper.find('text');
		expect(text.attributes('fill')).toBe('#ff0000');
		expect(text.attributes('font-size')).toBe('32');
	});

	it('renders nothing for a non-warped preset', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textPlain' } }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders nothing when no warp preset is set', () => {
		const wrapper = mount(WordArtText, {
			props: { element: warpedText({ textStyle: {} }), zIndex: 0 },
		});
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('renders nothing for a non-text element', () => {
		const img = {
			type: 'image',
			id: 'i1',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
		} as PptxElement;
		const wrapper = mount(WordArtText, { props: { element: img, zIndex: 0 } });
		expect(wrapper.find('svg').exists()).toBeFalsy();
	});

	it('emits one baseline path per paragraph', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					textSegments: [
						{ text: 'Line 1', style: {} },
						{ text: '', style: {}, isParagraphBreak: true },
						{ text: 'Line 2', style: {} },
					],
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.findAll('defs path')).toHaveLength(2);
		expect(wrapper.findAll('textPath')).toHaveLength(2);
	});

	it('uses hyperlink colour and underline for hyperlink runs', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					// No element-level colour, so the hyperlink fallback colour applies
					// (mirrors React: element colour, when present, wins over HYPERLINK_COLOR).
					textStyle: { textWarpPreset: 'textArchUp' },
					text: '',
					textSegments: [{ text: 'click', style: { hyperlink: 'https://x.test' } }],
				}),
				zIndex: 0,
			},
		});
		const tspan = wrapper.find('tspan');
		expect(tspan.attributes('fill')).toBe('#0563C1');
		expect(tspan.attributes('text-decoration')).toContain('underline');
	});

	it('maps centre alignment to a mid textPath anchor', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textArchUp', align: 'center' } }),
				zIndex: 0,
			},
		});
		const tp = wrapper.find('textPath');
		expect(tp.attributes('text-anchor')).toBe('middle');
		expect(tp.attributes('startOffset')).toBe('50%');
	});

	it('renders one <text> per glyph (true two-curve envelope), not a shared textPath', () => {
		// Regression pin: envelope presets used to fall back to a flat
		// `.pptx-vue-wordart-css` box with a CSS `transform` approximation, then
		// later to a shared-baseline `<textPath>` (see the WordArt envelope
		// fidelity fix docs above). Neither varies glyph HEIGHT across the
		// line the way PowerPoint's own two-curve envelope does, so this now
		// renders one `<text>` per glyph with its own `translate/scale`.
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textInflate', color: '#00ff00' } }),
				zIndex: 4,
			},
		});
		expect(wrapper.find('svg.pptx-vue-wordart').exists()).toBeTruthy();
		expect(wrapper.find('textPath').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-wordart-css').exists()).toBeFalsy();
		const glyphTexts = wrapper.findAll('svg > text');
		expect(glyphTexts).toHaveLength('Hello'.length);
		expect(glyphTexts.map((t) => t.text()).join('')).toBe('Hello');
		expect(glyphTexts[0].attributes('fill')).toBe('#00ff00');
		expect(glyphTexts[0].attributes('transform')).toContain('matrix(1');
	});

	it('varies scaleY across an inflate line (the fixed residual: glyph height between curves)', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					textStyle: { textWarpPreset: 'textInflate' },
					text: 'INFLATED TEXT',
				}),
				zIndex: 0,
			},
		});
		const scales = wrapper
			.findAll('svg > text')
			.map((t) => matrixScaleY(t.attributes('transform') ?? ''));
		expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
	});

	it('a multi-paragraph inflate element still uses the per-glyph envelope for every line', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					textStyle: { textWarpPreset: 'textInflate' },
					text: '',
					textSegments: [
						{ text: 'Top', style: {} },
						{ text: '', style: {}, isParagraphBreak: true },
						{ text: 'Bottom', style: {} },
					],
				}),
				zIndex: 0,
			},
		});
		expect(wrapper.find('textPath').exists()).toBeFalsy();
		// 'Top' (3) + 'Bottom' (6) = 9 glyphs total.
		expect(wrapper.findAll('svg > text')).toHaveLength(9);
	});

	it('a short caption of very wide glyphs on a steep can-up curve renders sliced glyphs, clipped and seamed', () => {
		// Wide "M"s at extreme adj: exactly the "6-8 very wide glyphs filling
		// the box" residual from limitations.md, where a single affine per
		// glyph is no longer enough (see `chooseGlyphSliceCount` in
		// pptx-viewer-shared). happy-dom has no real canvas 2D context, so
		// `measureGlyphAdvances` falls back to a deterministic `fontSize * 0.55`
		// per character: 3 "M"s at fontSize 160 measure 88px each, ~29% of a
		// 300px line per glyph.
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({
					width: 300,
					height: 120,
					text: 'MMM',
					textStyle: { textWarpPreset: 'textCanUp', textWarpAdj: 66667, fontSize: 160 },
				}),
				zIndex: 0,
			},
		});
		const glyphGroups = wrapper.findAll('svg > g[data-glyph-slices]');
		expect(glyphGroups.length).toBeGreaterThan(0);
		for (const group of glyphGroups) {
			const sliceTexts = group.findAll('text');
			const clipPaths = group.findAll('clipPath');
			expect(sliceTexts).toHaveLength(clipPaths.length);
			expect(sliceTexts.length).toBeGreaterThan(1);
			const ids = new Set<string>();
			for (const t of sliceTexts) {
				const clip = t.attributes('clip-path') ?? '';
				const id = /url\(#([^)]+)\)/u.exec(clip)?.[1];
				expect(id).toBeTruthy();
				ids.add(id!);
			}
			expect(ids.size).toBe(sliceTexts.length);
		}
		// A single-slice glyph still renders as a bare <text> direct svg
		// child, not wrapped in a group - ordinary captions pay no cost.
		const bareGlyphs = wrapper.findAll('svg > text');
		expect(bareGlyphs.length + glyphGroups.length).toBe('MMM'.length);
	});

	it('renders a true SVG textPath (not a CSS transform) for a former "simple" preset', () => {
		// textSlantUp/textFadeRight/textCascadeUp etc. moved from the CSS-transform
		// `simple` family to true SVG textPath once their generators became
		// single-line-safe.
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textSlantUp' } }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('svg.pptx-vue-wordart').exists()).toBeTruthy();
		expect(wrapper.find('textPath').exists()).toBeTruthy();
		expect(wrapper.find('.pptx-vue-wordart-css').exists()).toBeFalsy();
	});

	it('keeps using a textPath (not a CSS box) for a path preset', () => {
		const wrapper = mount(WordArtText, {
			props: {
				element: warpedText({ textStyle: { textWarpPreset: 'textArchUp' } }),
				zIndex: 0,
			},
		});
		expect(wrapper.find('textPath').exists()).toBeTruthy();
		expect(wrapper.find('.pptx-vue-wordart-css').exists()).toBeFalsy();
	});
});
