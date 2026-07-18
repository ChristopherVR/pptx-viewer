// @vitest-environment happy-dom
import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import { DEFAULT_VIEWER_OPTIONS, VIEWER_PREFS_STORAGE_KEY } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useViewerOptions } from './useViewerOptions';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	localStorage.clear();
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	localStorage.clear();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
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
});
