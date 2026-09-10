// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { buildForeignObjectSvgBody, wrapForeignObjectSvg } from './foreign-object-svg-document';

describe('wrapForeignObjectSvg', () => {
	it('wraps the body markup in an outer <svg> sized and windowed for one tile', () => {
		const svg = wrapForeignObjectSvg('<rect/>', {
			viewBoxX: 10,
			viewBoxY: 20,
			viewBoxWidth: 100,
			viewBoxHeight: 50,
			outputWidth: 400,
			outputHeight: 200,
		});

		expect(svg).toBe(
			'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
				'width="400" height="200" viewBox="10 20 100 50"><rect/></svg>',
		);
	});

	it('produces a full-size (non-tiled) window when the viewBox covers the natural size', () => {
		const svg = wrapForeignObjectSvg('<g></g>', {
			viewBoxX: 0,
			viewBoxY: 0,
			viewBoxWidth: 1920,
			viewBoxHeight: 1080,
			outputWidth: 1920,
			outputHeight: 1080,
		});
		expect(svg).toContain('viewBox="0 0 1920 1080"');
		expect(svg).toContain('width="1920" height="1080"');
	});
});

describe('buildForeignObjectSvgBody', () => {
	it('inlines computed styles, embeds fonts already present via @font-face <style>, and wraps content in foreignObject', async () => {
		document.body.innerHTML = '';
		const fontStyle = document.createElement('style');
		fontStyle.textContent =
			"@font-face { font-family: 'Calibri'; src: url(data:font/woff2;base64,AAA); }";
		document.head.appendChild(fontStyle);

		const el = document.createElement('div');
		el.textContent = 'Hello';
		document.body.appendChild(el);

		const body = await buildForeignObjectSvgBody(el, document, {
			width: 300,
			height: 150,
			backgroundColor: '#ffffff',
		});

		expect(body.naturalWidth).toBe(300);
		expect(body.naturalHeight).toBe(150);
		expect(body.allEmbedded).toBeTruthy();
		expect(body.bodyMarkup).toContain('@font-face');
		expect(body.bodyMarkup).toContain('Calibri');
		expect(body.bodyMarkup).toContain('<foreignObject x="0" y="0" width="300" height="150">');
		expect(body.bodyMarkup).toContain('fill="#ffffff"');
		expect(body.bodyMarkup).toContain('Hello');

		document.head.removeChild(fontStyle);
		document.body.removeChild(el);
	});

	it('omits the background rect and <defs> when neither is supplied', async () => {
		document.body.innerHTML = '';
		const el = document.createElement('div');
		el.textContent = 'No bg';
		document.body.appendChild(el);

		const body = await buildForeignObjectSvgBody(el, document, { width: 10, height: 10 });

		expect(body.bodyMarkup).not.toContain('<defs>');
		expect(body.bodyMarkup).not.toContain('<rect');

		document.body.removeChild(el);
	});

	/**
	 * The documented fidelity claim (docs/guide/limitations.md: "backdrop-filter,
	 * CSS custom properties, and CSS 3D transforms are reproduced instead of
	 * approximated") cannot be measured against real slide content today: a
	 * repo-wide grep of every binding's renderer (packages/{react,vue,angular,
	 * svelte,vanilla}/src, packages/shared/src/render) found `backdrop-filter`
	 * used only in CHROME UI (dialogs, toolbars, the mobile bottom bar) - no
	 * OOXML/PPTX feature maps to it on slide content, and PNG/PDF export only
	 * ever captures the slide stage, never chrome. This test verifies the
	 * MECHANISM directly instead: unlike `export/css-preprocessing.ts`'s
	 * `flattenBackdropFilter` (which deliberately *removes* backdrop-filter
	 * because html2canvas cannot paint it), this foreignObject path must
	 * preserve it verbatim, since the browser's own engine paints the
	 * foreignObject content and therefore can.
	 */
	it('preserves backdrop-filter verbatim (the html2canvas path deliberately strips it; this path must not)', async () => {
		document.body.innerHTML = '';
		const el = document.createElement('div');
		el.style.backdropFilter = 'blur(8px)';
		el.textContent = 'Frosted';
		document.body.appendChild(el);

		const body = await buildForeignObjectSvgBody(el, document, { width: 50, height: 50 });

		expect(body.bodyMarkup).toContain('backdrop-filter:blur(8px)');

		document.body.removeChild(el);
	});

	/**
	 * Computed style resolves `var()` references to their concrete value (a
	 * browser invariant `getComputedStyle` guarantees: a computed value never
	 * contains an unresolved `var()`), so inlining computed style is sufficient
	 * to make a custom-property-driven declaration self-contained without any
	 * special-casing. jsdom's CSSOM does not implement `var()` resolution in
	 * `getComputedStyle` (a known jsdom limitation, unlike every real browser),
	 * so this test injects an already-resolved `readComputedStyle` to prove the
	 * copy-through mechanism, rather than asserting on jsdom's (incorrect)
	 * resolution behavior; the resolution itself is a real-browser guarantee,
	 * not something this module implements.
	 */
	it('carries a custom-property-resolved computed value through untouched (no unresolved var() re-introduced)', async () => {
		document.body.innerHTML = '';
		const el = document.createElement('div');
		document.body.appendChild(el);

		const body = await buildForeignObjectSvgBody(el, document, {
			width: 20,
			height: 20,
			readComputedStyle: () => ({
				length: 1,
				item: (i: number) => (i === 0 ? 'background-color' : ''),
				getPropertyValue: (prop: string) => (prop === 'background-color' ? 'rgb(255, 0, 0)' : ''),
			}),
		});

		expect(body.bodyMarkup).toContain('background-color:rgb(255, 0, 0)');
		expect(body.bodyMarkup).not.toContain('var(');

		document.body.removeChild(el);
	});
});
