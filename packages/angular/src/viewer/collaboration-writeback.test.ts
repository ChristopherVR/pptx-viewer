/**
 * The elected-writer (`role: 'owner'`) write-back scheduler used to call
 * `handler.save(slides)` with NO options, so an owner's write-back file
 * silently dropped every session-level edit outside `slides` (table style
 * edits, view toggles, tags, deck properties, ...). This asserts the new
 * `getSaveOptions` param reaches the `handler.save(...)` call.
 */
import type { PptxHandlerSaveOptions } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadMock = vi.fn().mockResolvedValue({});
const saveMock = vi.fn().mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));

vi.mock(import('pptx-viewer-core'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		PptxHandler: vi.fn().mockImplementation(function PptxHandlerMock(this: object) {
			Object.assign(this, { load: loadMock, save: saveMock });
		}),
	};
});

vi.mock(import('../internal/shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		readSlidesFromYDoc: vi.fn().mockReturnValue([{ id: 's1', elements: [] }]),
	};
});

const { serializeWriteBack, WriteBackScheduler } = await import('./collaboration-writeback');

describe('serializeWriteBack getSaveOptions wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadMock.mockResolvedValue({});
		saveMock.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
	});

	it('passes saveOptions through to handler.save', async () => {
		const saveOptions: PptxHandlerSaveOptions = { viewProperties: { showComments: true } };
		await serializeWriteBack({} as never, new Uint8Array([1, 2, 3]), {}, saveOptions);

		expect(saveMock).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], saveOptions);
	});

	it('passes undefined when no saveOptions are given (pre-existing behaviour)', async () => {
		await serializeWriteBack({} as never, new Uint8Array([1, 2, 3]), {});

		expect(saveMock).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], undefined);
	});
});

describe('writeBackScheduler getSaveOptions wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadMock.mockResolvedValue({});
		saveMock.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		vi.useFakeTimers();
	});

	it('forwards getSaveOptions() to serializeWriteBack on fire', async () => {
		const saveOptions: PptxHandlerSaveOptions = { tags: [{ tags: [] }] };
		const onWriteBack = vi.fn();
		const scheduler = new WriteBackScheduler();

		scheduler.schedule(
			{ role: 'owner', onWriteBack, writeBackDebounceMs: 0 } as never,
			{} as never,
			() => new Uint8Array([1, 2, 3]),
			() => ({}),
			() => saveOptions,
		);
		await vi.runAllTimersAsync();

		expect(saveMock).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], saveOptions);
		vi.useRealTimers();
	});
});
