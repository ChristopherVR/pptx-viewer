/**
 * The elected-writer (`role: 'owner'`) write-back scheduler used to call
 * `handler.save(slides)` with NO options, so an owner's write-back file
 * silently dropped every session-level edit outside `slides` (table style
 * edits, view toggles, tags, deck properties, ...). This asserts the new
 * `getSaveOptions` dep reaches the `handler.save(...)` call.
 */
import type { PptxHandler, PptxHandlerSaveOptions } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		readSlidesFromYDoc: vi.fn().mockReturnValue([{ id: 's1', elements: [] }]),
	};
});

const { createWriteBackScheduler } = await import('./collaboration-writeback');

function config(overrides: Partial<CollaborationConfig> = {}): CollaborationConfig {
	return {
		role: 'owner',
		onWriteBack: vi.fn(),
		writeBackDebounceMs: 0,
		...overrides,
	} as unknown as CollaborationConfig;
}

describe('vanilla createWriteBackScheduler getSaveOptions wiring', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('passes getSaveOptions() through to handler.save', async () => {
		const saveOptions: PptxHandlerSaveOptions = { viewProperties: { showComments: true } };
		const save = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		const handler = { save } as unknown as PptxHandler;
		const onWriteBack = vi.fn();
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as YDocLike,
			getHandler: () => handler,
			getSaveOptions: () => saveOptions,
		});

		scheduler.schedule(config({ onWriteBack }));
		await vi.runAllTimersAsync();

		expect(save).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], saveOptions);
		vi.useRealTimers();
	});

	it('calls handler.save with undefined options when getSaveOptions is not supplied', async () => {
		const save = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
		const handler = { save } as unknown as PptxHandler;
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as YDocLike,
			getHandler: () => handler,
		});

		scheduler.schedule(config());
		await vi.runAllTimersAsync();

		expect(save).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], undefined);
		vi.useRealTimers();
	});
});
