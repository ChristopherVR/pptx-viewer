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
import type { PptxElement, PptxHandler, PptxHandlerSaveOptions, PptxSlide } from 'pptx-viewer-core';
import { PptxHandler as RealPptxHandler } from 'pptx-viewer-core';
import type { PendingInlineTextEdit } from 'pptx-viewer-shared';
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

async function newDeckBytes(elements?: PptxElement[]): Promise<Uint8Array> {
	const { handler, data } = await RealPptxHandler.create({ initialSlideCount: 1 });
	try {
		if (elements) {
			data.slides[0].elements = elements;
		}
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
	it('serializes a current list draft without committing the live model', async () => {
		const scope = effectScope();
		let pending: PendingInlineTextEdit | undefined;
		try {
			const bytes = await newDeckBytes([
				{
					id: 'draft-list',
					type: 'text',
					x: 30,
					y: 30,
					width: 200,
					height: 100,
					text: 'Original',
					textSegments: [{ text: 'Original', style: {} }],
				},
			]);
			await scope.run(async () => {
				const deck = useLoadContent(() => bytes, { getPendingInlineEdit: () => pending });
				await settle(deck);
				expect(deck.loading.value).toBeFalsy();
				expect(deck.error.value).toBeNull();
				const source = deck.slides.value[0].elements[0];
				expect(source.rawXml).toBeDefined();
				pending = {
					target: { slideId: deck.slides.value[0].id },
					snapshot: {
						elementId: source.id,
						text: 'Current body',
						textSegments: [
							{
								text: 'Current body',
								style: { fontSize: 30 },
								paragraphLevel: 1,
								bulletInfo: { char: '◆' },
							},
						],
					},
				};
				const reader = new RealPptxHandler();
				try {
					const result = await reader.load(await deck.getContent());
					expect(result.slides[0].elements[0]).toMatchObject({
						text: expect.stringContaining('Current body'),
					});
					expect(result.slides[0].elements[0].textSegments).toStrictEqual(
						expect.arrayContaining([
							expect.objectContaining({
								paragraphLevel: 1,
								bulletInfo: expect.objectContaining({ char: '◆' }),
							}),
						]),
					);
					expect(deck.slides.value[0].elements[0]).toBe(source);
					expect(source.text).toBe('Original');
					pending = undefined;
					const unchanged = await reader.load(await deck.getContent());
					expect(unchanged.slides[0].elements[0].text).toBe('Original');
				} finally {
					reader.dispose();
				}
			});
		} finally {
			scope.stop();
		}
	});

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
