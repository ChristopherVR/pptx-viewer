// @vitest-environment node
/**
 * Do the View-ribbon grid/guide/snap toggles reach the saved file?
 *
 * `useDeckViewPreferencesSync` writes each toggle into `viewProperties`, but
 * `serialize()` never forwarded that ref, so core fell back to `viewProps.xml`
 * as it was FIRST opened and every session change silently reverted at the
 * file boundary. Records the options object the way
 * `useLoadContent.table-styles.test.ts` does, since the OPTIONS OBJECT is what
 * the bug was about.
 */
import type { PptxHandler, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler as RealPptxHandler } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';

import { useLoadContent } from './useLoadContent';

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

function recordingHandler(): { handler: PptxHandler; seen: PptxHandlerSaveOptions[] } {
	const seen: PptxHandlerSaveOptions[] = [];
	const handler = {
		save: (_slides: PptxSlide[], options?: PptxHandlerSaveOptions) => {
			seen.push(options ?? {});
			return Promise.resolve(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		},
		dispose: () => {},
	} as unknown as PptxHandler;
	return { handler, seen };
}

describe('view properties reach the save call', () => {
	it('forwards the session viewProperties into saveOptions', async () => {
		const bytes = await newDeckBytes();
		const scope = effectScope();
		try {
			await scope.run(async () => {
				const content = ref<Uint8Array | null>(bytes);
				const deck = useLoadContent(() => content.value);
				await settle(deck);

				const { handler: fakeHandler, seen } = recordingHandler();
				deck.handler.value = fakeHandler;
				// What the View ribbon's grid-spacing / comments toggles write.
				deck.viewProperties.value = {
					...deck.viewProperties.value,
					showComments: false,
					gridSpacing: { cx: 152400, cy: 152400 },
				};

				await deck.getContent();

				expect(seen).toHaveLength(1);
				expect(seen[0]?.viewProperties?.showComments).toBeFalsy();
				expect(seen[0]?.viewProperties?.gridSpacing).toStrictEqual({ cx: 152400, cy: 152400 });
			});
		} finally {
			scope.stop();
		}
	});
});
