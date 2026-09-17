import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollaborationConfig } from '../types';
import type { ExternalCollaborationSession } from './collaboration-external-session';

const mockDoc = {} as never;
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
			getYDoc: () => mockDoc,
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

	it('uses a retained serializer without reloading source bytes', async () => {
		const bytes = new Uint8Array([7]);
		const serialize = vi.fn((isCurrent: () => boolean) => {
			expect(isCurrent()).toBeTruthy();
			return bytes;
		});
		const scheduler = createWriteBackScheduler({ getYDoc: () => mockDoc, serialize });
		const session = config();
		scheduler.schedule(session);
		await vi.runAllTimersAsync();
		expect(loadMock).not.toHaveBeenCalled();
		expect(serialize).toHaveBeenCalledOnce();
		expect(session.onWriteBack).toHaveBeenCalledWith(bytes);
	});

	it.each(['source', 'retained'] as const)(
		'contains an async host callback rejection with the %s serializer',
		async (mode) => {
			const bytes = new Uint8Array([7]);
			let attempts = 0;
			const onWriteBack = async (): Promise<void> => {
				attempts++;
				if (attempts === 1) {
					throw new Error('Host save failed');
				}
			};
			const scheduler = createWriteBackScheduler({
				getYDoc: () => mockDoc,
				getSourceBytes: () => bytes,
				...(mode === 'retained' ? { serialize: () => bytes } : {}),
			});
			const session = config({ onWriteBack });
			scheduler.schedule(session);
			await vi.runAllTimersAsync();
			scheduler.schedule(session);
			await vi.runAllTimersAsync();
			expect(attempts).toBe(2);
		},
	);

	it.each(['cancel', 'replace', 'unsync'] as const)(
		'revokes a retained serializer after %s',
		async (cause) => {
			let finish!: (bytes: Uint8Array) => void;
			let isCurrent!: () => boolean;
			let document = mockDoc;
			const host = externalConfig();
			const scheduler = createWriteBackScheduler({
				getYDoc: () => document,
				serialize: (check) => {
					isCurrent = check;
					return new Promise((resolve) => {
						finish = resolve;
					});
				},
			});
			scheduler.schedule(host.config);
			vi.advanceTimersByTime(0);
			expect(isCurrent()).toBeTruthy();
			if (cause === 'cancel') {
				scheduler.cancel();
			}
			if (cause === 'replace') {
				document = {} as never;
			}
			if (cause === 'unsync') {
				host.setSynced(false);
				host.setSynced(true);
			}
			expect(isCurrent()).toBeFalsy();
			finish(new Uint8Array([7]));
			await Promise.resolve();
			expect(host.config.onWriteBack).not.toHaveBeenCalled();
			expect(host.listeners.size).toBe(0);
		},
	);

	it('cancels a pending host snapshot when sync is lost', async () => {
		const host = externalConfig();
		const scheduler = createWriteBackScheduler({
			getYDoc: () => mockDoc,
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
				getYDoc: () => mockDoc,
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
			getYDoc: () => mockDoc,
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
			getYDoc: () => mockDoc,
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
			getYDoc: () => mockDoc,
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
			getYDoc: () => mockDoc,
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
