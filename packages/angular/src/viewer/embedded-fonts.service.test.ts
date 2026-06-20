/**
 * embedded-fonts.service.test.ts: Unit tests for the DOM-injection side
 * effects of EmbeddedFontsService (vitest + happy-dom, no TestBed).
 *
 * The service calls `inject(DestroyRef)` in its constructor, so it is built
 * inside a minimal injection context via `runInInjectionContext` with an
 * `Injector` that provides a capturing `DestroyRef` stub. This lets us assert
 * the registered teardown without pulling in TestBed / the Angular compiler.
 *
 * Mirrors the Vue `useEmbeddedFonts.test.ts` injection + cleanup assertions.
 */

import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxEmbeddedFont } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import { EMBEDDED_FONTS_STYLE_ID } from './embedded-fonts-helpers';
import { EmbeddedFontsService } from './embedded-fonts.service';

const TINY_DATA_URL = 'data:font/ttf;base64,AAEAAA==';

function makeFont(overrides: Partial<PptxEmbeddedFont>): PptxEmbeddedFont {
	return {
		name: 'CustomSans',
		dataUrl: TINY_DATA_URL,
		format: 'truetype',
		...overrides,
	};
}

/**
 * Build an EmbeddedFontsService inside an injection context, capturing the
 * teardown callback the service registers via `DestroyRef.onDestroy`.
 */
function makeService(): { svc: EmbeddedFontsService; destroy: () => void } {
	let teardown: (() => void) | undefined;
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = {
		onDestroy: (cb: () => void) => {
			teardown = cb;
			return () => {};
		},
	};
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	const svc = runInInjectionContext(injector, () => new EmbeddedFontsService());
	return {
		svc,
		// Prefer the teardown the service registered via DestroyRef.onDestroy
		// (exercising that wiring); fall back to dispose() if the stub never
		// captured it.
		destroy: () => (teardown ? teardown() : svc.dispose()),
	};
}

describe('embeddedFontsService', () => {
	// happy-dom shares one document across tests; scrub any leftover style
	// elements so each case starts from a clean <head>.
	afterEach(() => {
		for (const el of Array.from(document.querySelectorAll(`#${EMBEDDED_FONTS_STYLE_ID}`))) {
			el.remove();
		}
	});

	it('starts with empty signals and no injected style element', () => {
		const { svc, destroy } = makeService();
		expect(svc.fontFaceCss()).toBe('');
		expect(svc.fontFamilies()).toStrictEqual([]);
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).toBeNull();
		destroy();
	});

	it('injects a <style> element into <head> and exposes signals', () => {
		const { svc, destroy } = makeService();
		svc.setFonts([makeFont({ name: 'Injected' })]);

		const styleEl = document.getElementById(EMBEDDED_FONTS_STYLE_ID);
		expect(styleEl).not.toBeNull();
		expect(styleEl?.textContent).toContain('font-family: "Injected"');
		expect(svc.fontFaceCss()).toContain('font-family: "Injected"');
		expect(svc.fontFamilies()).toHaveLength(1);
		expect(svc.fontFamilies()[0]).toContain('"Injected"');

		destroy();
	});

	it('removes the injected <style> and clears signals on destroy', () => {
		const { svc, destroy } = makeService();
		svc.setFonts([makeFont({ name: 'Injected' })]);
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).not.toBeNull();

		destroy();
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).toBeNull();
		expect(svc.fontFaceCss()).toBe('');
		expect(svc.fontFamilies()).toStrictEqual([]);
	});

	it('removes the <style> element when fonts are cleared', () => {
		const { svc, destroy } = makeService();
		svc.setFonts([makeFont({ name: 'Injected' })]);
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).not.toBeNull();

		svc.setFonts([]);
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).toBeNull();
		expect(svc.fontFaceCss()).toBe('');

		destroy();
	});

	it('reuses a single <style> element across re-parses', () => {
		const { svc, destroy } = makeService();
		svc.setFonts([makeFont({ name: 'First' })]);
		const first = document.getElementById(EMBEDDED_FONTS_STYLE_ID);

		svc.setFonts([makeFont({ name: 'Second' })]);
		const second = document.getElementById(EMBEDDED_FONTS_STYLE_ID);

		expect(second).toBe(first);
		expect(second?.textContent).toContain('font-family: "Second"');
		expect(second?.textContent).not.toContain('font-family: "First"');

		destroy();
	});

	it('rejects a malicious family name (no style injected)', () => {
		const { svc, destroy } = makeService();
		svc.setFonts([makeFont({ name: 'Evil"; } body { display:none } @font-face { src:url(x' })]);
		expect(svc.fontFaceCss()).toBe('');
		expect(svc.fontFamilies()).toStrictEqual([]);
		expect(document.getElementById(EMBEDDED_FONTS_STYLE_ID)).toBeNull();
		destroy();
	});
});
