// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { isExportIgnoredElement, prepareExportClone } from './export-clone';
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
	it('restores explicit authored paint after style copying without erasing shape decoration', async () => {
		const el = document.createElement('div');
		el.innerHTML = '<div id="shape">Authored text</div><div id="unmarked">Shadow</div>';
		const shape = el.firstElementChild as HTMLElement;
		shape.style.cssText =
			'outline: 2px solid blue; outline-offset: -1px; box-shadow: 0 0 0 2px blue; border: 3px solid red; border-radius: 8px; clip-path: polygon(0 0, 100% 0, 0 100%); filter: drop-shadow(1px 2px 3px black)';
		shape.dataset.exportOriginalOutline = 'none';
		shape.dataset.exportOriginalOutlineOffset = '0px';
		shape.dataset.exportOriginalBoxShadow = 'inset 0 0 0 3px red, 2px 3px 4px black';
		shape.dataset.exportOriginalBorder = 'none';
		(el.lastElementChild as HTMLElement).style.boxShadow = '4px 5px 6px black';
		document.body.appendChild(el);
		const original = el.outerHTML;
		try {
			const body = await buildForeignObjectSvgBody(el, document, { width: 100, height: 50 });
			const parsed = document.createElement('div');
			parsed.innerHTML = body.bodyMarkup;
			const exported = parsed.querySelector<HTMLElement>('#shape')!;
			expect(exported.style.outline).toBe('none');
			expect(exported.style.outlineOffset).toBe('0px');
			expect(exported.style.boxShadow).toBe(shape.dataset.exportOriginalBoxShadow);
			expect(exported.style.border).toBe(getComputedStyle(shape).border);
			expect(exported.style.borderRadius).toBe('8px');
			expect(exported.style.clipPath).toBe(shape.style.clipPath);
			expect(exported.style.filter).toBe(shape.style.filter);
			expect(parsed.querySelector<HTMLElement>('#unmarked')!.style.boxShadow).toBe(
				'4px 5px 6px black',
			);
			expect(el.outerHTML).toBe(original);
		} finally {
			el.remove();
		}
	});

	it('prepares a fallback clone including paint recorded on its root', () => {
		const clone = document.createElement('div');
		clone.style.outline = '2px solid blue';
		clone.dataset.exportOriginalOutline = '1px dashed orange';
		clone.innerHTML =
			'<svg><circle data-export-ignore="true"/><path/></svg><div data-export-ignore="false">Keep</div>';
		expect(isExportIgnoredElement(clone.querySelector('circle')!)).toBeTruthy();
		expect(isExportIgnoredElement(clone.lastElementChild!)).toBeFalsy();
		expect(isExportIgnoredElement(clone)).toBeFalsy();
		prepareExportClone(clone);
		expect(clone.style.outline).toBe('1px dashed orange');
		expect(clone.querySelector('circle')).toBeNull();
		expect(clone.querySelector('path')).not.toBeNull();
		expect(clone.textContent).toBe('Keep');
	});

	it('omits marked HTML and SVG editor nodes without changing content or the live tree', async () => {
		const el = document.createElement('div');
		el.innerHTML =
			'<div data-export-ignore="true">Resize<button>Rotate</button></div>' +
			'<div data-export-ignore="false">Authored text</div>' +
			'<svg><path data-export-ignore="true" d="M0 0L1 1"/><path d="M1 1L2 2"/></svg>';
		document.body.appendChild(el);
		const original = el.outerHTML;

		try {
			const body = await buildForeignObjectSvgBody(el, document, { width: 100, height: 50 });
			expect(body.bodyMarkup).not.toContain('Resize');
			expect(body.bodyMarkup).not.toContain('Rotate');
			expect(body.bodyMarkup).not.toContain('M0 0L1 1');
			expect(body.bodyMarkup).toContain('Authored text');
			expect(body.bodyMarkup).toContain('M1 1L2 2');
			expect(el.outerHTML).toBe(original);
		} finally {
			el.remove();
		}
	});

	it('preserves following sibling styles and skips resources in omitted editor nodes', async () => {
		const el = document.createElement('div');
		el.innerHTML =
			'<div data-export-ignore="true"><img src="https://example.invalid/editor-icon.png"/></div>' +
			'<span style="color: rgb(1, 2, 3)">Authored content</span>';
		document.body.appendChild(el);
		const fetchSpy = vi.spyOn(globalThis, 'fetch');

		try {
			const body = await buildForeignObjectSvgBody(el, document, { width: 100, height: 50 });
			expect(body.bodyMarkup).toContain('color:rgb(1, 2, 3)');
			expect(body.bodyMarkup).toContain('Authored content');
			expect(body.bodyMarkup).not.toContain('editor-icon');
			expect(body.allEmbedded).toBeTruthy();
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			fetchSpy.mockRestore();
			el.remove();
		}
	});

	it('preserves nested SVG namespaces and valid XML for authored paths, references and HTML', async () => {
		const element = document.createElement('div');
		element.innerHTML =
			'<svg id="art" viewBox="0 0 100 50"><defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient><path id="line" d="M0 0L100 50"/></defs><use href="#line" stroke="url(#paint)"/><foreignObject width="100" height="50"><div id="caption">A &amp; B &lt; C<br>Next<img src="data:image/png;base64,AA=="></div></foreignObject></svg>';
		document.body.appendChild(element);
		element
			.querySelector('use')!
			.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#line');
		const original = element.outerHTML;
		try {
			const body = await buildForeignObjectSvgBody(element, document, { width: 100, height: 50 });
			const xml = wrapForeignObjectSvg(body.bodyMarkup, {
				viewBoxX: 0,
				viewBoxY: 0,
				viewBoxWidth: 100,
				viewBoxHeight: 50,
				outputWidth: 100,
				outputHeight: 50,
			});
			const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
			expect(parsed.querySelector('parsererror')).toBeNull();
			for (const selector of ['#art', '#paint', '#line', 'use', 'stop']) {
				expect(parsed.querySelector(selector)?.namespaceURI).toBe('http://www.w3.org/2000/svg');
			}
			expect(parsed.querySelector('use')?.getAttribute('href')).toBe('#line');
			expect(
				parsed.querySelector('use')?.getAttributeNS('http://www.w3.org/1999/xlink', 'href'),
			).toBe('#line');
			expect(parsed.querySelector('#line')?.getAttribute('d')).toBe('M0 0L100 50');
			for (const selector of ['#caption', 'br', 'img']) {
				expect(parsed.querySelector(selector)?.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
			}
			expect(parsed.querySelector('#caption')?.textContent).toBe('A & B < CNext');
			expect(element.outerHTML).toBe(original);
		} finally {
			element.remove();
		}
	});

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
