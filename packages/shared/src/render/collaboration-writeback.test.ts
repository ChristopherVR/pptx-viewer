import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollaborationConfig } from '../types';
import type { ExternalCollaborationSession } from './collaboration-external-session';

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
	afterEach(() => vi.useRealTimers());

	function config(overrides: Partial<CollaborationConfig> = {}): CollaborationConfig {
		return {
			role: 'owner',
			onWriteBack: vi.fn(),
			writeBackDebounceMs: 0,
			...overrides,
		} as unknown as CollaborationConfig;
	}

	function externalConfig(initiallySynced = true) {
		let synced = initiallySynced;
		const listeners = new Set<() => void>();
		const externalSession = {
			getSnapshot: () => ({ status: 'disconnected', synced }),
			subscribe: (listener: () => void) => {
				listeners.add(listener);
				return () => listeners.delete(listener);
			},
		} as ExternalCollaborationSession;
		return {
			config: config({ externalSession }),
			listeners,
			setSynced: (value: boolean) => {
				synced = value;
				for (const listener of listeners) {
					listener();
				}
			},
		};
	}

	it('only schedules host snapshots once synced, including synced offline sessions', async () => {
		const host = externalConfig(false);
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1]),
		});
		scheduler.schedule(host.config);
		await vi.runAllTimersAsync();
		expect(loadMock).not.toHaveBeenCalled();
		host.setSynced(true);
		scheduler.schedule(host.config);
		await vi.runAllTimersAsync();
		expect(host.config.onWriteBack).toHaveBeenCalledOnce();
		expect(host.listeners.size).toBe(0);
	});

	it('cancels a pending host snapshot when sync is lost', async () => {
		const host = externalConfig();
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1]),
		});
		scheduler.schedule(host.config);
		host.setSynced(false);
		host.setSynced(true);
		await vi.runAllTimersAsync();
		expect(loadMock).not.toHaveBeenCalled();
		expect(host.listeners.size).toBe(0);
	});

	it.each(['load', 'save'])(
		'invalidates an in-flight %s even if the host re-syncs before it finishes',
		async (stage) => {
			let finish!: () => void;
			const deferred = new Promise((resolve) => {
				finish = () => resolve(new Uint8Array([2]));
			});
			(stage === 'load' ? loadMock : saveMock).mockReturnValue(deferred);
			const host = externalConfig();
			const scheduler = createWriteBackScheduler({
				getYDoc: () => ({}) as never,
				getSourceBytes: () => new Uint8Array([1]),
			});
			scheduler.schedule(host.config);
			vi.advanceTimersByTime(0);
			await Promise.resolve();
			host.setSynced(false);
			host.setSynced(true);
			finish();
			await Promise.resolve();
			await Promise.resolve();
			expect(host.config.onWriteBack).not.toHaveBeenCalled();
			if (stage === 'load') {
				expect(saveMock).not.toHaveBeenCalled();
			}
			expect(host.listeners.size).toBe(0);
		},
	);

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

	it('does not finish an in-flight write-back after its session was stopped', async () => {
		let finishSave!: (bytes: Uint8Array) => void;
		saveMock.mockReturnValue(
			new Promise<Uint8Array>((resolve) => {
				finishSave = resolve;
			}),
		);
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1]),
		});
		const session = config();
		scheduler.schedule(session);
		vi.advanceTimersByTime(0);
		await Promise.resolve();
		expect(saveMock).toHaveBeenCalledOnce();
		scheduler.cancel();
		finishSave(new Uint8Array([2]));
		await Promise.resolve();
		expect(session.onWriteBack).not.toHaveBeenCalled();
	});

	it('does not read replacement-session options after an obsolete source load completes', async () => {
		let finishLoad!: (value: object) => void;
		loadMock.mockReturnValue(
			new Promise<object>((resolve) => {
				finishLoad = resolve;
			}),
		);
		const getSaveOptions = vi.fn();
		const scheduler = createWriteBackScheduler({
			getYDoc: () => ({}) as never,
			getSourceBytes: () => new Uint8Array([1]),
			getSaveOptions,
		});
		const session = config();
		scheduler.schedule(session);
		vi.advanceTimersByTime(0);
		scheduler.cancel();
		finishLoad({});
		await Promise.resolve();
		expect(saveMock).not.toHaveBeenCalled();
		expect(getSaveOptions).not.toHaveBeenCalled();
		expect(session.onWriteBack).not.toHaveBeenCalled();
	});
});
