// @vitest-environment happy-dom
/**
 * `WarpedText` (the SVG `<textPath>` WordArt renderer).
 *
 * Regression coverage for the WordArt envelope fidelity fix: React already
 * routed every classified preset (`shouldUseSvgWarp`, the BROAD shared set)
 * to this true SVG textPath renderer, unlike Vue/Svelte/Angular, which each
 * had their own narrower gate that fell back to a flat CSS-transform overlay
 * for the envelope (inflate/deflate/can) and former "simple" (slant/fade/
 * cascade) families - see those bindings' own warp tests for the matching
 * regression pins. This locks React's (already-correct) behaviour in place,
 * and pins the shared path-generator fix that made a single-paragraph
 * element (the common WordArt case) actually bend instead of rendering a
 * perfectly flat, unwarped baseline.
 *
 * No `@testing-library/react` in this workspace; uses the manual `createRoot`
 * + `act` harness (see `OlePropertiesPanel.test.tsx`).
 */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { WarpedText } from './warp-text-renderer';

let container: HTMLDivElement | undefined;
let root: Root | undefined;

/** The `d` (vertical scale) term out of a glyph's `matrix(1 b 0 d 0 f)` transform. */
function matrixScaleY(transform: string): number {
	const terms = transform.replace('matrix(', '').replace(')', '').trim().split(/\s+/u);
	return Number(terms[3]);
}

afterEach(() => {
	if (root) {
		act(() => root!.unmount());
	}
	container?.remove();
	container = undefined;
	root = undefined;
});

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

function multiParagraphWarpedElement(preset: string): PptxElement {
	return {
		type: 'text',
		id: 'wa-multi',
		x: 0,
		y: 0,
		width: 300,
		height: 150,
		textStyle: { textWarpPreset: preset },
		textSegments: [
			{ text: 'Top', style: {} },
			{ text: '', style: {}, isParagraphBreak: true },
			{ text: 'Bottom', style: {} },
		],
	} as PptxElement;
}

function renderWarpedElement(element: PptxElement, height = 100): HTMLDivElement {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<WarpedText element={element} width={300} height={height} fallbackColor='#111827' />,
		);
	});
	return container;
}

function renderWarped(preset: string): HTMLDivElement {
	return renderWarpedElement(warpedElement(preset));
}

describe('warpedText: envelope/former-simple presets render as true SVG textPath', () => {
	it.each(['textInflate', 'textDeflate', 'textCanUp', 'textCanDown'])(
		'renders one <text> per glyph (true two-curve envelope) for the preset %s, not a shared <textPath>',
		(preset) => {
			const el = renderWarped(preset);
			expect(el.querySelector('svg')).not.toBeNull();
			// The envelope family now renders one `<text>` per glyph (each with
			// its own transform), not a shared-baseline `<textPath>`.
			expect(el.querySelector('textPath')).toBeNull();
			expect(el.querySelectorAll('svg > text')).toHaveLength('Hello'.length);
		},
	);

	it.each(['textSlantUp', 'textFadeLeft', 'textFadeRight', 'textCascadeDown'])(
		'renders an <svg><textPath> for the former "simple" preset %s',
		(preset) => {
			const el = renderWarped(preset);
			expect(el.querySelector('svg')).not.toBeNull();
			expect(el.querySelector('textPath')).not.toBeNull();
		},
	);

	it('a single-paragraph inflate element varies glyph height across the line (the two-curve fix)', () => {
		const el = renderWarped('textInflate');
		const scales = [...el.querySelectorAll('svg > text')].map((t) =>
			matrixScaleY(t.getAttribute('transform') ?? ''),
		);
		expect(new Set(scales.map((s) => s.toFixed(4))).size).toBeGreaterThan(1);
	});

	it('renders nothing for textPlain', () => {
		const el = renderWarped('textPlain');
		expect(el.querySelector('svg')).toBeNull();
	});

	it('a multi-paragraph inflate element still uses the per-glyph envelope for every line', () => {
		const el = renderWarpedElement(multiParagraphWarpedElement('textInflate'), 150);
		// 'Top' (3) + 'Bottom' (6) = 9 glyphs total, never a shared <textPath>.
		expect(el.querySelector('textPath')).toBeNull();
		expect(el.querySelectorAll('svg > text')).toHaveLength(9);
	});

	it('a short caption of very wide glyphs on a steep can-up curve renders sliced glyphs, clipped and seamed', () => {
		// Wide "M"s at extreme adj: exactly the "6-8 very wide glyphs filling
		// the box" residual from limitations.md, where a single affine per
		// glyph is no longer enough (see `chooseGlyphSliceCount`).
		// `renderWarpedElement` always passes a 300px-wide box to `WarpedText`
		// (the box on `element` itself is unused here). happy-dom has no real
		// canvas 2D context, so `measureGlyphAdvances` falls back to a
		// deterministic `fontSize * 0.55` per character (see that function's
		// doc comment): 3 "M"s at fontSize 160 measure 88px each, ~29% of the
		// 300px line per glyph.
		const el = renderWarpedElement({
			type: 'text',
			id: 'wa-wide',
			x: 0,
			y: 0,
			width: 300,
			height: 120,
			text: 'MMM',
			textStyle: { textWarpPreset: 'textCanUp', textWarpAdj: 66667, fontSize: 160 },
		} as PptxElement);
		const svg = el.querySelector('svg')!;
		const glyphGroups = svg.querySelectorAll(':scope > g[data-glyph-slices]');
		expect(glyphGroups.length).toBeGreaterThan(0);
		for (const g of glyphGroups) {
			const sliceTexts = g.querySelectorAll('text');
			const clipPaths = g.querySelectorAll('clipPath');
			expect(sliceTexts).toHaveLength(clipPaths.length);
			expect(sliceTexts.length).toBeGreaterThan(1);
			// Every slice `<text>` references a distinct, existing clipPath id.
			const ids = new Set<string>();
			for (const t of sliceTexts) {
				const clip = t.getAttribute('clip-path') ?? '';
				const id = /url\(#([^)]+)\)/u.exec(clip)?.[1];
				expect(id).toBeTruthy();
				ids.add(id!);
				expect(svg.querySelector(`clipPath#${CSS.escape(id!)}`)).not.toBeNull();
			}
			expect(ids.size).toBe(sliceTexts.length);
		}
		// A single-slice glyph (unaffected by this fixture, but asserted
		// generally) still renders as a bare `<text>` direct svg child, not
		// wrapped in a group - ordinary captions pay no cost.
		const bareGlyphs = svg.querySelectorAll(':scope > text');
		expect(bareGlyphs.length + glyphGroups.length).toBe('MMM'.length);
	});

	it('a multi-paragraph inflate element bends line 0 above line 1 (band slicing)', () => {
		const el = renderWarpedElement(multiParagraphWarpedElement('textInflate'), 150);
		const texts = [...el.querySelectorAll('svg > text')];
		const yOf = (t: Element): number => {
			const transform = t.getAttribute('transform') ?? '';
			const tMatch = /translate\(\s*[-\d.]+\s+(-?[\d.]+)\s*\)/u.exec(transform);
			const sMatch = /scale\(\s*1\s+(-?[\d.]+)\s*\)/u.exec(transform);
			const y = Number(t.getAttribute('y'));
			return Number(tMatch?.[1] ?? 0) + Number(sMatch?.[1] ?? 1) * y;
		};
		// First 3 glyphs belong to "Top", the last 6 to "Bottom".
		const topYs = texts.slice(0, 3).map(yOf);
		const bottomYs = texts.slice(3).map(yOf);
		expect(Math.max(...topYs)).toBeLessThan(Math.min(...bottomYs));
	});
});
