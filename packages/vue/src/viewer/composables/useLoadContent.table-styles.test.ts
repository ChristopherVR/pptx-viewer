// @vitest-environment node
/**
 * Does a table style DEFINITION edit ("Edit style...") reach the saved file?
 *
 * `TableStyleOptions.vue`/`TableStyleEditor.vue` were wired in W4-E but
 * nothing threaded `tableStyleMap`/`tableStylesDefaultId`/`tableStylesToDelete`
 * into `useLoadContent`'s `serialize()` options, so an edit rendered live but
 * reverted on reload. Mirrors `slide-size-save.test.ts`'s wiring style but
 * records the options object instead of round-tripping through a real
 * `PptxHandler`, since the OPTIONS OBJECT is what the bug was about.
 */
import type {
	ParsedTableStyleMap,
	PptxHandler,
	PptxHandlerSaveOptions,
	PptxSlide,
} from 'pptx-viewer-core';
import { PptxHandler as RealPptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useLoadContent } from './useLoadContent';

/** Drive the load pipeline to completion (its watcher is `immediate`). */
async function settle(deck: ReturnType<typeof useLoadContent>): Promise<void> {
	for (let i = 0; i < 200 && (deck.loading.value || !deck.handler.value); i++) {
		await nextTick();
		await new Promise((resolve) => {
			setTimeout(resolve, 10);
		});
	}
}

async function newDeckBytes(): Promise<Uint8Array> {
	const { handler, data } = await RealPptxHandler.create({ initialSlideCount: 1 });
	try {
		return await handler.save(data.slides);
	} finally {
		handler.dispose();
	}
}

/** A stand-in handler whose only job is to record the options it is given. */
function recordingHandler(): { handler: PptxHandler; seen: PptxHandlerSaveOptions[] } {
	const seen: PptxHandlerSaveOptions[] = [];
	const handler = {
		save: (_slides: PptxSlide[], options?: PptxHandlerSaveOptions) => {
			seen.push(options ?? {});
			return Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		},
		// The scope's teardown disposes whatever handler is live when it stops.
		dispose: () => {},
	} as unknown as PptxHandler;
	return { handler, seen };
}

const STYLE_MAP: ParsedTableStyleMap = {
	'{guid}': { styleId: '{guid}', styleName: 'Edited' },
};

describe('table style editor edits reach the save call', () => {
	it('forwards tableStyleMap/tableStylesDefaultId/tableStylesToDelete into saveOptions', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);

				const { handler: fakeHandler, seen } = recordingHandler();
				deck.handler.value = fakeHandler;
				deck.tableStyleMap.value = STYLE_MAP;
				deck.tableStylesDefaultId.value = '{guid}';
				deck.tableStylesToDelete.value = ['{deleted-guid}'];

				await deck.getContent();

				expect(seen).toHaveLength(1);
				expect(seen[0]?.tableStyles).toStrictEqual(STYLE_MAP);
				expect(seen[0]?.tableStylesDefaultId).toBe('{guid}');
				expect(seen[0]?.tableStylesToDelete).toStrictEqual(['{deleted-guid}']);
			});
		} finally {
			scope.stop();
		}
	});

	it('omits tableStyles/tableStylesToDelete, but forwards whatever default id was loaded, when nothing has been edited', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);

				const { handler: fakeHandler, seen } = recordingHandler();
				deck.handler.value = fakeHandler;

				await deck.getContent();

				// A brand-new deck's `tableStyleMap`/`tableStylesToDelete` are seeded
				// empty (undefined / []), so `tableStyleSaveOptions` omits both; a
				// blank deck DOES ship a default table style GUID, so that one field
				// is forwarded as-loaded, same as `viewProperties`.
				expect(seen[0]?.tableStyles).toBeUndefined();
				expect(seen[0]?.tableStylesToDelete).toBeUndefined();
				expect(seen[0]?.tableStylesDefaultId).toBe(deck.tableStylesDefaultId.value);
			});
		} finally {
			scope.stop();
		}
	});
});
