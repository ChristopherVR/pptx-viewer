// oxlint-disable react-hooks/rules-of-hooks
import type { PptxEmbeddedFont } from 'pptx-viewer-core';
import { obfuscateFont } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useEmbeddedFonts } from './useEmbeddedFonts';

/** Minimal valid TrueType sfnt header (0x00010000) so `detectFontFormat` is happy. */
function makeTtfBytes(): Uint8Array {
	const bytes = new Uint8Array(48);
	bytes[0] = 0x00;
	bytes[1] = 0x01;
	bytes[2] = 0x00;
	bytes[3] = 0x00;
	for (let i = 4; i < bytes.length; i++) {
		bytes[i] = (i * 7) & 0xff;
	}
	return bytes;
}

const TINY_DATA_URL = 'data:font/ttf;base64,AAEAAA==';

function makeFont(overrides: Partial<PptxEmbeddedFont>): PptxEmbeddedFont {
	return {
		name: 'CustomSans',
		dataUrl: TINY_DATA_URL,
		format: 'truetype',
		...overrides,
	};
}

/** Run `fn` inside an effect scope so `onScopeDispose` works, returning a stop fn. */
function withScope<T>(fn: () => T): { result: T; stop: () => void } {
	const scope = effectScope();
	const result = scope.run(fn)!;
	return { result, stop: () => scope.stop() };
}

function countFontFaceRules(css: string): number {
	return (css.match(/@font-face/gu) ?? []).length;
}

describe('useEmbeddedFonts', () => {
	it('builds two @font-face rules for a font with regular + bold variants', async () => {
		const fonts: PptxEmbeddedFont[] = [
			makeFont({ name: 'CustomSans', bold: false, italic: false }),
			makeFont({ name: 'CustomSans', bold: true, italic: false }),
		];

		const { result, stop } = withScope(() => useEmbeddedFonts(ref(fonts)));
		await nextTick();

		const css = result.fontFaceCss.value;
		expect(countFontFaceRules(css)).toBe(2);
		expect(css).toContain('font-family: "CustomSans"');
		expect(css).toMatch(/font-weight: 400;/u);
		expect(css).toMatch(/font-weight: 700;/u);

		// A single distinct embedded family (with substitution fallbacks).
		expect(result.fontFamilies.value).toHaveLength(1);
		expect(result.fontFamilies.value[0]).toContain('"CustomSans"');

		stop();
	});

	it('maps italic and boldItalic variants to the right font-style', async () => {
		const fonts: PptxEmbeddedFont[] = [
			makeFont({ name: 'Fancy', bold: false, italic: true }),
			makeFont({ name: 'Fancy', bold: true, italic: true }),
		];
		const { result, stop } = withScope(() => useEmbeddedFonts(() => fonts));
		await nextTick();

		const css = result.fontFaceCss.value;
		expect(countFontFaceRules(css)).toBe(2);
		const italicRules = css.match(/font-style: italic;/gu) ?? [];
		expect(italicRules).toHaveLength(2);
		expect(css).toMatch(/font-weight: 700;/u);

		stop();
	});

	it('de-obfuscates obfuscated bytes when no data URL is present', async () => {
		const guid = 'F7A0C94A-3F90-4C3A-AE50-B05A7B0F6C65';
		const clear = makeTtfBytes();
		// obfuscateFont === deobfuscateFont (XOR self-inverse) — produce the
		// scrambled bytes a PPTX would have stored on disk.
		const obfuscated = obfuscateFont(clear, guid);

		const font: PptxEmbeddedFont = {
			name: 'ObfFont',
			dataUrl: '', // loader could not build a usable data URL
			format: 'truetype',
			bold: false,
			italic: false,
			fontGuid: guid,
			originalPartBytes: obfuscated,
		};

		const { result, stop } = withScope(() => useEmbeddedFonts(ref([font])));
		await nextTick();

		const css = result.fontFaceCss.value;
		expect(countFontFaceRules(css)).toBe(1);
		expect(css).toContain('font-family: "ObfFont"');
		// A blob: object URL should have been minted for the de-obfuscated bytes.
		expect(css).toMatch(/url\("blob:/u);

		stop();
	});

	it('injects a <style> element into <head> and cleans it up on scope dispose', async () => {
		const { stop } = withScope(() => useEmbeddedFonts(ref([makeFont({ name: 'Injected' })])));
		await nextTick();

		const styleEl = document.getElementById('pptx-vue-embedded-fonts');
		expect(styleEl).not.toBeNull();
		expect(styleEl?.textContent).toContain('font-family: "Injected"');

		stop();
		expect(document.getElementById('pptx-vue-embedded-fonts')).toBeNull();
	});

	it('rejects fonts whose name could break out of the @font-face block', async () => {
		const malicious = makeFont({ name: 'Evil"; } body { display:none } @font-face { src:url(x' });
		const { result, stop } = withScope(() => useEmbeddedFonts(ref([malicious])));
		await nextTick();

		expect(result.fontFaceCss.value).toBe('');
		expect(result.fontFamilies.value).toHaveLength(0);

		stop();
	});

	it('produces no CSS for an empty font list', async () => {
		const { result, stop } = withScope(() => useEmbeddedFonts(ref([] as PptxEmbeddedFont[])));
		await nextTick();
		expect(result.fontFaceCss.value).toBe('');
		expect(document.getElementById('pptx-vue-embedded-fonts')).toBeNull();
		stop();
	});
});
