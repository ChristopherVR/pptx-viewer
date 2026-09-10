import { Font, Glyph, Path } from 'opentype.js';
import type { PptxElement, PptxEmbeddedFont } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { glyphOutlineFontCache } from '../state/glyph-outline-cache.svelte';
import WordArtText from './WordArtText.svelte';

/** A minimal, self-contained TrueType-shaped font, built with opentype.js's own object model. */
function buildTestFont(): Uint8Array {
	const notdefGlyph = new Glyph({
		name: '.notdef',
		unicode: 0,
		advanceWidth: 650,
		path: new Path(),
	});
	const rectPath = new Path();
	rectPath.moveTo(100, 0);
	rectPath.lineTo(100, 700);
	rectPath.lineTo(500, 700);
	rectPath.lineTo(500, 0);
	rectPath.close();
	const glyphs = [notdefGlyph];
	for (const ch of new Set('Hello')) {
		glyphs.push(
			new Glyph({ name: ch, unicode: ch.codePointAt(0), advanceWidth: 650, path: rectPath }),
		);
	}
	const font = new Font({
		familyName: 'WarpOutlineSvelteTestFont',
		styleName: 'Regular',
		unitsPerEm: 1000,
		ascender: 800,
		descender: -200,
		glyphs,
	});
	return new Uint8Array(font.toArrayBuffer());
}

let cleanup: (() => void) | undefined;

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

/**
 * One DOM element per LOGICAL glyph, in glyph order: a bare `svg > text` for
 * an unsliced glyph, or its whole `svg > g[data-glyph-slices]` group for a
 * glyph `chooseGlyphSliceCount` (`pptx-viewer-shared`) split into several
 * clipped pieces. A plain descendant `text` selector (as this file's tests
 * used to use) OVERcounts a sliced glyph's several inner `<text>` pieces as
 * separate glyphs once the box-fill horizontal-placement fix
 * (`text-warp-envelope-layout.ts`'s `stretch`) makes an ordinary caption span
 * the box's own curve extremes, where slicing now legitimately kicks in more
 * often than the old natural-width-centred layout ever reached.
 */
function logicalGlyphElements(root: ParentNode): Element[] {
	return [...root.querySelectorAll('svg > text, svg > g[data-glyph-slices]')];
}

/** The representative `<text>` element for one logical glyph node (see {@link logicalGlyphElements}). */
function representativeTextEl(node: Element): Element {
	return node.tagName.toLowerCase() === 'g' ? (node.querySelector('text') ?? node) : node;
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
		const glyphTexts = (svg ? logicalGlyphElements(svg) : []).map(representativeTextEl);
		expect(glyphTexts).toHaveLength('Hello'.length);
		expect(glyphTexts.map((t) => t.textContent).join('')).toBe('Hello');
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
		expect(svg ? logicalGlyphElements(svg) : []).toHaveLength(9);
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

	it('renders warped <path> outlines (not <text>) once the font is registered in the outline cache', () => {
		const embedded: PptxEmbeddedFont = {
			name: 'WarpOutlineSvelteTestFont',
			dataUrl: '',
			rawFontData: buildTestFont(),
		};
		glyphOutlineFontCache.registerEmbeddedFonts([embedded]);
		const svg = mountWarped(
			warpedText({
				textStyle: {
					textWarpPreset: 'textInflate',
					fontFamily: 'WarpOutlineSvelteTestFont',
					color: '#123456',
				},
			}),
		);
		const paths = svg?.querySelectorAll('path') ?? [];
		expect(paths).toHaveLength('Hello'.length);
		expect(svg?.querySelector('text')).toBeNull();
		for (const p of paths) {
			expect(p.getAttribute('d')?.startsWith('M')).toBeTruthy();
			expect(p.getAttribute('fill')).toBe('#123456');
		}
	});
});
