import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollaborationConfig } from '../types';

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

vi.mock(import('./collaboration-sync'), async (importOriginal) => {
	const actual = await importOriginal();
	return {
		...actual,
		readSlidesFromYDoc: vi.fn().mockReturnValue([{ id: 's1', elements: [] }]),
	};
});

const { createWriteBackScheduler } = await import('./collaboration-writeback');

describe('createWriteBackScheduler getSaveOptions wiring', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		loadMock.mockResolvedValue({});
		saveMock.mockResolvedValue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
		vi.useFakeTimers();
	});

	function config(overrides: Partial<CollaborationConfig> = {}): CollaborationConfig {
		return {
			role: 'owner',
			onWriteBack: vi.fn(),
			writeBackDebounceMs: 0,
			...overrides,
		} as unknown as CollaborationConfig;
	}

	it('passes getSaveOptions() through to handler.save so session-level edits survive write-back', async () => {
		const saveOptions = { viewProperties: { showComments: true }, tags: [{ tags: [] }] };
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1, 2, 3]),
			getSaveOptions: () => saveOptions as never,
		});

		scheduler.schedule(config());
		await vi.runAllTimersAsync();

		expect(saveMock).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], saveOptions);
		vi.useRealTimers();
	});

	it('calls handler.save with undefined options when getSaveOptions is not supplied (pre-existing behaviour)', async () => {
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1, 2, 3]),
		});

		scheduler.schedule(config());
		await vi.runAllTimersAsync();

		expect(saveMock).toHaveBeenCalledExactlyOnceWith([{ id: 's1', elements: [] }], undefined);
		vi.useRealTimers();
	});
});
