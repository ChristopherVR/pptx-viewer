/**
 * font-embedding-save.test.ts: File ▸ Fonts ▸ "Embed fonts in the file" must
 * change the bytes that get written.
 *
 * The toggle shipped in every binding and was read by nobody: it reached no
 * save call, so a deck saved byte-identical whichever way it sat. `useFontEmbedding`
 * now seeds it from the loaded deck (a deck that arrives with embedded fonts
 * keeps them, so the switch starts ON) and `useLoadContent` spreads
 * `embeddedFontSaveOptions` into the save options.
 *
 * This asserts the PACKAGE, not that a spy fired: the `.fntdata` part and
 * `p:embeddedFontLst` are present with the toggle on and gone with it off.
 */
// @vitest-environment node
// Node rather than the package-wide happy-dom: nothing here renders, and the
// save path is pure ZIP/XML work.
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useFontEmbedding } from './useFontEmbedding';
import { useLoadContent } from './useLoadContent';

/** Build a tiny real `.pptx` that embeds one font. */
async function buildDeckWithEmbeddedFont(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		const rawFontData = new Uint8Array(64);
		// A plausible TrueType signature so the loader resolves the part.
		rawFontData.set([0, 1, 0, 0]);
		return await handler.save(data.slides, {
			embeddedFonts: [{ name: 'Probe Face', dataUrl: '', rawFontData, format: 'truetype' }],
		});
	} finally {
		handler.dispose();
	}
}

/** Font parts + list presence for a saved package. */
async function inspect(bytes: Uint8Array): Promise<{ parts: string[]; hasList: boolean }> {
	const zip = await JSZip.loadAsync(bytes);
	const presentation = await zip.file('ppt/presentation.xml')!.async('string');
	return {
		parts: Object.keys(zip.files).filter((path) => path.endsWith('.fntdata')),
		hasList: presentation.includes('embeddedFontLst'),
	};
}

describe('font embedding save wiring', () => {
	it('keeps the embedded font when the toggle is on and strips it when off', async () => {
		const bytes = await buildDeckWithEmbeddedFont();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				// Exactly the wiring `PowerPointViewer.vue` performs.
				const wiring: { panel?: ReturnType<typeof useFontEmbedding> } = {};
				const deck = useLoadContent(() => content.value, {
					getEmbedFonts: () => wiring.panel?.embedFontsEnabled.value ?? true,
				});
				const fontEmbedding = useFontEmbedding({
					slides: deck.slides,
					embeddedFonts: deck.embeddedFonts,
				});
				wiring.panel = fontEmbedding;

				// Wait for the load pipeline to settle (the watcher is `immediate`).
				for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
					await nextTick();
					await new Promise((resolve) => {
						setTimeout(resolve, 10);
					});
				}
				expect(deck.embeddedFonts.value.map((f) => f.name)).toStrictEqual(['Probe Face']);

				// Seeded from the deck: it arrived with an embedded font, and save
				// keeps those by default, so the switch has to say so from the start.
				expect(fontEmbedding.fontEmbedding.value.interactive).toBeTruthy();
				expect(fontEmbedding.embedFontsEnabled.value).toBeTruthy();

				const kept = await inspect(await deck.saveAs('pptx'));
				expect(kept.parts).toHaveLength(1);
				expect(kept.hasList).toBeTruthy();

				fontEmbedding.embedFontsEnabled.value = false;
				const stripped = await inspect(await deck.saveAs('pptx'));
				expect(stripped.parts).toStrictEqual([]);
				expect(stripped.hasList).toBeFalsy();
			});
		} finally {
			scope.stop();
		}
	}, 60_000);

	it('leaves the toggle inert and off for a deck that embeds nothing', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		const plain = await handler.save(data.slides);
		handler.dispose();

		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(plain);
				const deck = useLoadContent(() => content.value);
				const fontEmbedding = useFontEmbedding({
					slides: deck.slides,
					embeddedFonts: deck.embeddedFonts,
				});
				for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
					await nextTick();
					await new Promise((resolve) => {
						setTimeout(resolve, 10);
					});
				}
				expect(fontEmbedding.fontEmbedding.value.interactive).toBeFalsy();
				expect(fontEmbedding.fontEmbedding.value.disabledReasonKey).toBe(
					'pptx.fonts.embedUnavailable',
				);
				expect(fontEmbedding.embedFontsEnabled.value).toBeFalsy();
			});
		} finally {
			scope.stop();
		}
	}, 60_000);
});
