import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import WordArtText from './WordArtText.svelte';

let cleanup: (() => void) | undefined;

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

function warpedText(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id: 'wa-1',
		x: 0,
		y: 0,
		width: 300,
		height: 100,
		text: 'Hello',
		textStyle: { textWarpPreset: 'textArchUp', color: '#ff0000', fontSize: 32 },
		...overrides,
	} as PptxElement;
}

function mountWarped(element: PptxElement): SVGSVGElement | null {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(WordArtText, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1 },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target.querySelector('svg');
}

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

describe('wordArtText (Svelte)', () => {
	it('renders an svg with a textPath baseline for a path-family preset', () => {
		const svg = mountWarped(warpedText());
		expect(svg).not.toBeNull();
		expect(svg?.querySelector('textPath')).not.toBeNull();
	});

	it('renders nothing for a non-warped preset', () => {
		const svg = mountWarped(warpedText({ textStyle: { textWarpPreset: 'textPlain' } }));
		expect(svg).toBeNull();
	});

	it('renders one <text> per glyph (true two-curve envelope) for textInflate, not a shared textPath', () => {
		const svg = mountWarped(
			warpedText({ textStyle: { textWarpPreset: 'textInflate', color: '#00ff00' } }),
		);
		expect(svg).not.toBeNull();
		expect(svg?.querySelector('textPath')).toBeNull();
		const glyphTexts = svg?.querySelectorAll('text') ?? [];
		expect(glyphTexts).toHaveLength('Hello'.length);
		expect([...glyphTexts].map((t) => t.textContent).join('')).toBe('Hello');
		expect(glyphTexts[0].getAttribute('transform')).toContain('matrix(1');
	});

	it('varies scaleY across an inflate line (the fixed residual: glyph height between curves)', () => {
		const svg = mountWarped(
			warpedText({ textStyle: { textWarpPreset: 'textInflate' }, text: 'INFLATED TEXT' }),
		);
		const scales = [...(svg?.querySelectorAll('text') ?? [])].map((t) =>
			matrixScaleY(t.getAttribute('transform') ?? ''),
		);
		expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
	});

	it('a multi-paragraph inflate element still uses the per-glyph envelope for every line', () => {
		const svg = mountWarped(
			warpedText({
				textStyle: { textWarpPreset: 'textInflate' },
				text: '',
				textSegments: [
					{ text: 'Top', style: {} },
					{ text: '', style: {}, isParagraphBreak: true },
					{ text: 'Bottom', style: {} },
				],
			}),
		);
		expect(svg?.querySelector('textPath')).toBeNull();
		// 'Top' (3) + 'Bottom' (6) = 9 glyphs total.
		expect(svg?.querySelectorAll('text')).toHaveLength(9);
	});

	it('a short caption of very wide glyphs on a steep can-up curve renders sliced glyphs, clipped and seamed', () => {
		// Wide "M"s at extreme adj: exactly the "6-8 very wide glyphs filling
		// the box" residual from limitations.md, where a single affine per
		// glyph is no longer enough (see `chooseGlyphSliceCount` in
		// pptx-viewer-shared). No real canvas 2D context in this test
		// environment, so `measureGlyphAdvances` falls back to a deterministic
		// `fontSize * 0.55` per character: 3 "M"s at fontSize 160 measure 88px
		// each, ~29% of the default 300px-wide box per glyph.
		const svg = mountWarped(
			warpedText({
				textStyle: { textWarpPreset: 'textCanUp', textWarpAdj: 66667, fontSize: 160 },
				text: 'MMM',
			}),
		);
		const glyphGroups = svg?.querySelectorAll(':scope > g[data-glyph-slices]') ?? [];
		expect(glyphGroups.length).toBeGreaterThan(0);
		for (const g of glyphGroups) {
			const sliceTexts = g.querySelectorAll('text');
			const clipPaths = g.querySelectorAll('clipPath');
			expect(sliceTexts).toHaveLength(clipPaths.length);
			expect(sliceTexts.length).toBeGreaterThan(1);
			const ids = new Set<string>();
			for (const t of sliceTexts) {
				const clip = t.getAttribute('clip-path') ?? '';
				const id = /url\(#([^)]+)\)/u.exec(clip)?.[1];
				expect(id).toBeTruthy();
				ids.add(id!);
				expect(svg?.querySelector(`clipPath#${CSS.escape(id!)}`)).not.toBeNull();
			}
			expect(ids.size).toBe(sliceTexts.length);
		}
		// A single-slice glyph still renders as a bare <text> direct svg
		// child, not wrapped in a group - ordinary captions pay no cost.
		const bareGlyphs = svg?.querySelectorAll(':scope > text') ?? [];
		expect(bareGlyphs.length + glyphGroups.length).toBe('MMM'.length);
	});

	it('keeps using a textPath for a former "simple" preset', () => {
		const svg = mountWarped(warpedText({ textStyle: { textWarpPreset: 'textSlantUp' } }));
		expect(svg?.querySelector('textPath')).not.toBeNull();
	});
});
