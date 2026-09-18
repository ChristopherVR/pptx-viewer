// @vitest-environment happy-dom
import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import {
	DEFAULT_VIEWER_OPTIONS,
	VIEWER_PREFS_STORAGE_KEY,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	mergeViewerOptions,
} from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAutosaveCacheMaintenance } from './useAutosaveCacheMaintenance';
import { useViewerOptions } from './useViewerOptions';

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal<typeof import('pptx-viewer-shared')>()),
	listAutosaveSnapshots: vi.fn(),
	deleteAutosaveSnapshot: vi.fn(),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	vi.mocked(listAutosaveSnapshots).mockReset().mockResolvedValue([]);
	vi.mocked(deleteAutosaveSnapshot).mockReset().mockResolvedValue(true);
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	localStorage.clear();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
	localStorage.clear();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
	vi.restoreAllMocks();
});

interface Captured {
	store: ViewerOptionsStore;
	options: ViewerOptions;
}

function mountHook(): { current: () => Captured } {
	const captured: { value: Captured | null } = { value: null };
	function Probe(): null {
		const { optionsStore, options } = useViewerOptions();
		captured.value = { store: optionsStore, options };
		return null;
	}
	act(() => {
		root.render(React.createElement(Probe));
	});
	return {
		current: () => {
			expect(captured.value).not.toBeNull();
			return captured.value as Captured;
		},
	};
}

function readStoredOptions(): Record<string, Record<string, unknown>> {
	const raw = localStorage.getItem(VIEWER_PREFS_STORAGE_KEY);
	expect(raw).not.toBeNull();
	const parsed = JSON.parse(raw as string) as { options?: Record<string, Record<string, unknown>> };
	return parsed.options ?? {};
}

describe('useViewerOptions', () => {
	it('starts from the shared defaults', () => {
		const hook = mountHook();
		expect(hook.current().options).toStrictEqual(DEFAULT_VIEWER_OPTIONS);
	});

	it('reflects store changes in the reactive snapshot', () => {
		const hook = mountHook();
		act(() => {
			hook.current().store.setValue('advanced', 'maximumUndoSteps', 42);
		});
		expect(hook.current().options.advanced.maximumUndoSteps).toBe(42);
		// Untouched groups keep their default values.
		expect(hook.current().options.general.showMiniToolbar).toBeTruthy();
	});

	it('persists a sparse diff to localStorage', () => {
		const hook = mountHook();
		act(() => {
			hook.current().store.setValue('proofing', 'autoCorrectSmartQuotes', false);
			hook.current().store.setRibbonTabHidden('review', true);
		});
		const stored = readStoredOptions();
		expect(stored.proofing?.autoCorrectSmartQuotes).toBeFalsy();
		expect(stored.ribbon?.hiddenTabIds).toStrictEqual(['review']);
		// Defaults are not persisted (sparse diff).
		expect(stored.general).toBeUndefined();
	});

	it('hydrates persisted values in a fresh hook instance', () => {
		const first = mountHook();
		act(() => {
			first.current().store.setValue('save', 'autoRecoverIntervalMinutes', 7);
		});
		act(() => root.unmount());

		root = createRoot(container);
		const second = mountHook();
		expect(second.current().options.save.autoRecoverIntervalMinutes).toBe(7);
	});

	it('does not add cache maintenance to a headless options store', async () => {
		const add = vi.spyOn(window, 'addEventListener');
		const hook = mountHook();
		await act(async () => {
			hook.current().store.setValue('save', 'clearCacheOnClose', true);
			window.dispatchEvent(new Event('beforeunload'));
			root.render(null);
		});
		expect(listAutosaveSnapshots).not.toHaveBeenCalled();
		expect(deleteAutosaveSnapshot).not.toHaveBeenCalled();
		expect(add.mock.calls.filter(([name]) => name === 'beforeunload')).toHaveLength(0);
	});
});

function mountMaintenance(initial = DEFAULT_VIEWER_OPTIONS) {
	let clear: () => void;
	function Probe({ options }: { options: ViewerOptions }): null {
		clear = useAutosaveCacheMaintenance(options);
		return null;
	}
	const render = (options: ViewerOptions): void => {
		act(() => root.render(React.createElement(Probe, { options })));
	};
	render(initial);
	return { render, clear: () => clear };
}

describe('full-viewer autosave cache maintenance', () => {
	it('sweeps once using the mount options even if options change while listing', async () => {
		const now = 2_000_000_000_000;
		const day = 24 * 60 * 60 * 1000;
		vi.spyOn(Date, 'now').mockReturnValue(now);
		let resolve!: (value: Awaited<ReturnType<typeof listAutosaveSnapshots>>) => void;
		vi.mocked(listAutosaveSnapshots).mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			}),
		);
		const hook = mountMaintenance(mergeViewerOptions({ save: { cacheRetentionDays: 7 } }));
		hook.render(mergeViewerOptions({ save: { cacheRetentionDays: 30 } }));
		await act(async () => {
			resolve([
				{ key: 'expired', timestamp: now - 10 * day, size: 10 },
				{ key: 'boundary', timestamp: now - 7 * day, size: 10 },
				{ key: 'recent', timestamp: now, size: 10 },
			]);
		});
		expect(listAutosaveSnapshots).toHaveBeenCalledOnce();
		expect(deleteAutosaveSnapshot).toHaveBeenCalledExactlyOnceWith('expired');
	});

	it('returns the same module-level clear callback across renders and mounts', () => {
		const first = mountMaintenance();
		const clear = first.clear();
		first.render(mergeViewerOptions({ save: { cacheRetentionDays: 30 } }));
		expect(first.clear()).toBe(clear);
		act(() => root.render(null));
		expect(mountMaintenance().clear()).toBe(clear);
	});

	it('manually clears every snapshot regardless of retention or close preferences', async () => {
		const hook = mountMaintenance();
		await act(async () => {});
		vi.mocked(listAutosaveSnapshots).mockResolvedValueOnce([
			{ key: 'old', timestamp: 0, size: 10 },
			{ key: 'new', timestamp: Date.now(), size: 10 },
		]);
		await act(async () => {
			expect(hook.clear()()).toBeUndefined();
		});
		expect(vi.mocked(deleteAutosaveSnapshot).mock.calls).toStrictEqual([['old'], ['new']]);
	});

	it('removes the exact listener on option changes and unmount without clearing by default', async () => {
		const add = vi.spyOn(window, 'addEventListener');
		const remove = vi.spyOn(window, 'removeEventListener');
		const hook = mountMaintenance();
		hook.render(mergeViewerOptions({ general: { showMiniToolbar: false } }));
		await act(async () => {
			window.dispatchEvent(new Event('beforeunload'));
			root.render(null);
		});
		const added = add.mock.calls.filter(([name]) => name === 'beforeunload');
		const removed = remove.mock.calls.filter(([name]) => name === 'beforeunload');
		expect(added).toHaveLength(2);
		expect(removed).toStrictEqual(added);
		expect(listAutosaveSnapshots).toHaveBeenCalledOnce();
		expect(deleteAutosaveSnapshot).not.toHaveBeenCalled();
	});

	it('preserves clearing on requested close and option-effect cleanup', async () => {
		const enabled = mergeViewerOptions({ save: { clearCacheOnClose: true } });
		const hook = mountMaintenance(enabled);
		await act(async () => {});
		vi.mocked(listAutosaveSnapshots).mockResolvedValue([
			{ key: 'cached', timestamp: Date.now(), size: 10 },
		]);
		await act(async () => {
			window.dispatchEvent(new Event('beforeunload'));
		});
		expect(deleteAutosaveSnapshot).toHaveBeenCalledOnce();
		await act(async () => hook.render(DEFAULT_VIEWER_OPTIONS));
		expect(deleteAutosaveSnapshot).toHaveBeenCalledTimes(2);
		await act(async () => {
			window.dispatchEvent(new Event('beforeunload'));
		});
		expect(deleteAutosaveSnapshot).toHaveBeenCalledTimes(2);
		await act(async () => hook.render(enabled));
		await act(async () => root.render(null));
		expect(deleteAutosaveSnapshot).toHaveBeenCalledTimes(3);
		await act(async () => {
			window.dispatchEvent(new Event('beforeunload'));
		});
		expect(deleteAutosaveSnapshot).toHaveBeenCalledTimes(3);
	});

	it.each(['list', 'delete'] as const)(
		'ignores background sweep %s failures',
		async (operation) => {
			if (operation === 'list') {
				vi.mocked(listAutosaveSnapshots).mockRejectedValueOnce(new Error('Blocked storage'));
			} else {
				vi.mocked(listAutosaveSnapshots).mockResolvedValueOnce([
					{ key: 'expired', timestamp: 0, size: 10 },
				]);
				vi.mocked(deleteAutosaveSnapshot).mockRejectedValueOnce(new Error('Blocked storage'));
			}
			await act(async () => {
				mountMaintenance();
			});
			expect(listAutosaveSnapshots).toHaveBeenCalledOnce();
		},
	);
});
