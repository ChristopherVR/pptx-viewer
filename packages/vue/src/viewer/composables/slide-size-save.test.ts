// oxlint-disable react-hooks/rules-of-hooks
/**
 * slide-size-save.test.ts: a Design > Slide Size edit must reach the saved
 * `p:sldSz`.
 *
 * Vue shipped an editable SLIDE SIZE card whose value reached no save call: the
 * save-options object in `useLoadContent` listed `headerFooter`, `customShows`,
 * `sections` and a dozen others, and no slide size at all. The stage resized on
 * screen and the written package still carried whatever dimensions the deck
 * arrived with, so every slide-size edit was discarded at the file boundary.
 *
 * This asserts the PACKAGE, not that a spy fired: `ppt/presentation.xml` is
 * unzipped and its `p:sldSz` attributes are read back.
 */
// @vitest-environment node
// Node rather than the package-wide happy-dom: nothing here renders, and the
// save path is pure ZIP/XML work.
import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import { SLIDE_SIZE_PRESETS, slideSizeFromPreset, slideSizeToCanvasPx } from 'pptx-viewer-shared';
import type { SlideSizePreset } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useInspectorDeckActions } from './useInspectorDeckActions';
import { useLoadContent } from './useLoadContent';

function preset(labelKey: string): SlideSizePreset {
	const found = SLIDE_SIZE_PRESETS.find((candidate) => candidate.labelKey === labelKey);
	if (!found) {
		throw new Error(`no slide-size preset named ${labelKey}`);
	}
	return found;
}

/** `p:sldSz`'s three attributes, read straight out of the saved package. */
async function readSlideSize(
	bytes: Uint8Array,
): Promise<{ cx: string | null; cy: string | null; type: string | null }> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/presentation.xml')!.async('string');
	const tag = /<p:sldSz\b[^>]*\/?>/u.exec(xml)?.[0] ?? '';
	const attribute = (name: string): string | null =>
		new RegExp(`\\b${name}="([^"]*)"`, 'u').exec(tag)?.[1] ?? null;
	return { cx: attribute('cx'), cy: attribute('cy'), type: attribute('type') };
}

/** Drive the load pipeline to completion (its watcher is `immediate`). */
async function settle(deck: ReturnType<typeof useLoadContent>): Promise<void> {
	for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
		await nextTick();
		await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
	}
}

/** Exactly the wiring `PowerPointViewer.vue` performs for the inspector card. */
function wire(deck: ReturnType<typeof useLoadContent>): ReturnType<typeof useInspectorDeckActions> {
	return useInspectorDeckActions({
		handler: deck.handler,
		slideMasters: deck.slideMasters,
		canvasSize: deck.canvasSize,
		slideSize: deck.slideSize,
		coreProperties: deck.coreProperties,
		appProperties: deck.appProperties,
		customProperties: deck.customProperties,
		tagCollections: deck.tagCollections,
		markDirty: () => {},
	});
}

async function newDeckBytes(): Promise<Uint8Array> {
	const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

describe('slide size save wiring', () => {
	it('writes a chosen preset into p:sldSz without losing it through pixels', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);
				const actions = wire(deck);

				// Ledger: the preset that PROVES the EMU size wins. 12179300 EMU is
				// 1278.5px, so a round-trip through an integer pixel would write
				// 12172950 and cost the deck its ppSlideSizeLedgerPaper identity.
				const ledger = preset('ledger');
				const size = slideSizeFromPreset(ledger, 'landscape');
				actions.updateSlideSize(size, slideSizeToCanvasPx(size));

				expect(deck.canvasSize.value).toStrictEqual({ width: 1279, height: 959 });

				const saved = await readSlideSize(await deck.saveAs('pptx'));
				expect(saved.cx).toBe('12179300');
				expect(saved.cy).toBe('9134475');
				expect(saved.type).toBe('ledger');
			});
		} finally {
			scope.stop();
		}
	}, 60_000);

	it('swaps cx/cy for a portrait orientation and keeps the preset type', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);
				const actions = wire(deck);

				const size = slideSizeFromPreset(preset('a4'), 'portrait');
				actions.updateSlideSize(size, slideSizeToCanvasPx(size));

				const saved = await readSlideSize(await deck.saveAs('pptx'));
				expect(saved.cx).toBe('6858000');
				expect(saved.cy).toBe('9906000');
				// PowerPoint's Portrait toggle swaps the pair and nothing else, so a
				// portrait A4 deck is still an A4 deck.
				expect(saved.type).toBe('A4');
			});
		} finally {
			scope.stop();
		}
	}, 60_000);

	it('lets a hand-typed pixel size override the EMU state', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);
				const actions = wire(deck);

				// The raw W/H inputs edit pixels only; once they disagree with the
				// held EMU size the user has sized the deck by hand and pixels win.
				actions.updateCanvasSize({ width: 800, height: 600 });

				const saved = await readSlideSize(await deck.saveAs('pptx'));
				expect(saved.cx).toBe(String(800 * 9525));
				expect(saved.cy).toBe(String(600 * 9525));
			});
		} finally {
			scope.stop();
		}
	}, 60_000);

	it('seeds the EMU size from the loaded deck', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);
				expect(deck.slideSize.value?.widthEmu).toBeGreaterThan(0);
				expect(deck.slideSize.value?.heightEmu).toBeGreaterThan(0);
			});
		} finally {
			scope.stop();
		}
	}, 60_000);
});
