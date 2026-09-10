import { Font, Glyph, Path } from 'opentype.js';
import type { PptxElement, PptxEmbeddedFont } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { glyphOutlineFontCache } from '../../glyph-outline-cache';
import { createTranslator } from '../../i18n';
import { createElementRendererRegistry } from '../registry';
import type { ElementRenderContext } from '../types';
import { renderWarpedText } from './text-warp';

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
		familyName: 'WarpOutlineVanillaTestFont',
		styleName: 'Regular',
		unitsPerEm: 1000,
		ascender: 800,
		descender: -200,
		glyphs,
	});
	return new Uint8Array(font.toArrayBuffer());
}

/**
 * Regression coverage for the WordArt envelope fidelity fix.
 *
 * Vanilla's `renderWarpedText` already gated on the BROAD, shared
 * `shouldUseSvgWarp` (unlike Vue/Svelte/Angular, which each had their own
 * variant of a narrower gate that fell back to a flat CSS-transform overlay
 * for the envelope/simple families - see the Vue/Svelte/Angular text-warp
 * tests for the matching regression pins). This asserts vanilla keeps
 * rendering every classified preset as a true SVG textPath, including a
 * single-paragraph element, which is the common WordArt case and the one the
 * shared path generators used to render as a perfectly flat, unwarped
 * baseline for several presets (inflate/deflate/deflateInflateDeflate/
 * fadeLeft/fadeRight/button/buttonPour).
 */

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

function buildContext(): ElementRenderContext {
	const registry = createElementRendererRegistry();
	// eslint-disable-next-line one-var -- context self-references via renderElement
	const context: ElementRenderContext = {
		document,
		slide: { id: 'slide-1', rId: 'rId1', slideNumber: 1, elements: [] },
		canvasSize: { width: 1280, height: 720 },
		scale: 1,
		mediaDataUrls: new Map<string, string>(),
		t: createTranslator(),
		smartArt3D: false,
		surfaceChart3D: false,
		barChart3D: false,
		lineChart3D: false,
		areaChart3D: false,
		pieChart3D: false,
		presenting: false,
		registry,
		renderElement(element, zIndex) {
			return registry.resolve(element.type)(element, zIndex, context);
		},
	};
	return context;
}

function warpedElement(preset: string): PptxElement {
	return {
		type: 'text',
		id: 'wa-1',
		x: 0,
		y: 0,
		width: 300,
		height: 100,
		text: 'Hello',
		textStyle: { textWarpPreset: preset },
	} as PptxElement;
}

describe('renderWarpedText: envelope/former-simple presets render as true SVG textPath', () => {
	it.each(['textInflate', 'textDeflate', 'textCanUp', 'textCanDown'])(
		'renders one <text> per glyph (true two-curve envelope) for the preset %s, not a shared textPath',
		(preset) => {
			const node = renderWarpedText(warpedElement(preset), buildContext());
			expect(node).toBeTruthy();
			expect((node as SVGSVGElement).tagName.toLowerCase()).toBe('svg');
			// The envelope family now renders one `<text>` per glyph (each with
			// its own transform), not a shared-baseline `<textPath>`.
			expect(node?.querySelector('textPath')).toBeNull();
			expect(node?.classList.contains('pptxv-wordart')).toBeTruthy();
			expect(node?.querySelectorAll('text')).toHaveLength('Hello'.length);
		},
	);

	it.each(['textSlantUp', 'textFadeLeft', 'textFadeRight', 'textCascadeDown'])(
		'renders an <svg><textPath> for the former "simple" preset %s',
		(preset) => {
			const node = renderWarpedText(warpedElement(preset), buildContext());
			expect(node).toBeTruthy();
			expect((node as SVGSVGElement).tagName.toLowerCase()).toBe('svg');
			expect(node?.querySelector('textPath')).not.toBeNull();
		},
	);

	it('a single-paragraph inflate element varies glyph height across the line (the two-curve fix)', () => {
		const node = renderWarpedText(
			warpedElement('textInflate'),
			buildContext(),
		) as SVGSVGElement | null;
		const scales = [...(node?.querySelectorAll('text') ?? [])].map((t) =>
			matrixScaleY(t.getAttribute('transform') ?? ''),
		);
		expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
	});

	it('renders nothing for textPlain', () => {
		expect(renderWarpedText(warpedElement('textPlain'), buildContext())).toBeNull();
	});

	it('a short caption of very wide glyphs on a steep can-up curve renders sliced glyphs, clipped and seamed', () => {
		// Wide "M"s at extreme adj: exactly the "6-8 very wide glyphs filling
		// the box" residual from limitations.md, where a single affine per
		// glyph is no longer enough (see `chooseGlyphSliceCount` in
		// pptx-viewer-shared). No real canvas 2D context in this test
		// environment, so `measureGlyphAdvances` falls back to a deterministic
		// `fontSize * 0.55` per character: 3 "M"s at fontSize 160 measure 88px
		// each, ~29% of the 300px-wide box per glyph.
		const element: PptxElement = {
			type: 'text',
			id: 'wa-wide',
			x: 0,
			y: 0,
			width: 300,
			height: 120,
			text: 'MMM',
			textStyle: { textWarpPreset: 'textCanUp', textWarpAdj: 66667, fontSize: 160 },
		} as PptxElement;
		const node = renderWarpedText(element, buildContext()) as SVGSVGElement | null;
		const glyphGroups = node?.querySelectorAll(':scope > g[data-glyph-slices]') ?? [];
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
				expect(node?.querySelector(`clipPath#${CSS.escape(id!)}`)).not.toBeNull();
			}
			expect(ids.size).toBe(sliceTexts.length);
		}
		// A single-slice glyph still renders as a bare <text> direct svg
		// child, not wrapped in a group - ordinary captions pay no cost.
		const bareGlyphs = node?.querySelectorAll(':scope > text') ?? [];
		expect(bareGlyphs.length + glyphGroups.length).toBe('MMM'.length);
	});

	it('a multi-paragraph inflate element still uses the per-glyph envelope for every line', () => {
		const element: PptxElement = {
			type: 'text',
			id: 'wa-multi',
			x: 0,
			y: 0,
			width: 300,
			height: 150,
			textStyle: { textWarpPreset: 'textInflate' },
			textSegments: [
				{ text: 'Top', style: {} },
				{ text: '', style: {}, isParagraphBreak: true },
				{ text: 'Bottom', style: {} },
			],
		} as PptxElement;
		const node = renderWarpedText(element, buildContext()) as SVGSVGElement | null;
		expect(node?.querySelector('textPath')).toBeNull();
		// 'Top' (3) + 'Bottom' (6) = 9 glyphs total.
		expect(node?.querySelectorAll('text')).toHaveLength(9);
	});

	it('renders warped <path> outlines (not <text>) once the font is registered in the outline cache', () => {
		const embedded: PptxEmbeddedFont = {
			name: 'WarpOutlineVanillaTestFont',
			dataUrl: '',
			rawFontData: buildTestFont(),
		};
		glyphOutlineFontCache.registerEmbeddedFonts([embedded]);
		const element: PptxElement = {
			type: 'text',
			id: 'wa-outline',
			x: 0,
			y: 0,
			width: 300,
			height: 100,
			text: 'Hello',
			textStyle: {
				textWarpPreset: 'textInflate',
				fontFamily: 'WarpOutlineVanillaTestFont',
				color: '#123456',
			},
		} as PptxElement;
		const node = renderWarpedText(element, buildContext()) as SVGSVGElement | null;
		const paths = node?.querySelectorAll('path') ?? [];
		expect(paths).toHaveLength('Hello'.length);
		expect(node?.querySelector('text')).toBeNull();
		for (const p of paths) {
			expect(p.getAttribute('d')?.startsWith('M')).toBeTruthy();
			expect(p.getAttribute('fill')).toBe('#123456');
		}
	});
});
