import type { ToolbarTabId } from '../toolbar-actions';
import { readStoredViewerPrefs, writeStoredViewerPrefs } from '../viewer-prefs-storage';
import type {
	StoredViewerOptions,
	ViewerOptionPrimitive,
	ViewerOptions,
	ViewerOptionsGroupId,
} from './viewer-options';
import {
	DEFAULT_VIEWER_OPTIONS,
	cloneViewerOptions,
	diffViewerOptions,
	mergeViewerOptions,
} from './viewer-options';

/**
 * Framework-neutral store behind the File > Options dialog.
 *
 * Holds a `ViewerOptions` snapshot, notifies subscribers on change, and
 * persists a sparse diff into the shared `pptx-viewer-prefs` localStorage
 * entry so choices survive reloads in every binding.
 */

export type ViewerOptionsListener = (options: ViewerOptions) => void;

export interface ViewerOptionsStore {
	getOptions(): ViewerOptions;
	/** Replace the whole snapshot (e.g. hydrating from a host prop). */
	setOptions(next: ViewerOptions): void;
	/** Set one primitive value; ignores unknown keys and mismatched types. */
	setValue(group: ViewerOptionsGroupId, key: string, value: ViewerOptionPrimitive): void;
	getValue(group: ViewerOptionsGroupId, key: string): ViewerOptionPrimitive | undefined;
	/** Toggle a ribbon tab's visibility. The File tab is always kept visible. */
	setRibbonTabHidden(tabId: ToolbarTabId, hidden: boolean): void;
	setQuickAccessCommands(commandIds: readonly string[]): void;
	/** Reset every option (or one tab-group) back to defaults. */
	reset(group?: ViewerOptionsGroupId): void;
	subscribe(listener: ViewerOptionsListener): () => void;
}

export interface ViewerOptionsStoreInit {
	/** Seed values layered over defaults before persisted values are applied. */
	initial?: StoredViewerOptions;
	/** Skip localStorage entirely (hosts that own persistence themselves). */
	persist?: boolean;
}

export function createViewerOptionsStore(init?: ViewerOptionsStoreInit): ViewerOptionsStore {
	const persist = init?.persist !== false;
	const seeded = mergeViewerOptions(init?.initial);
	let options = persist ? overlayStored(seeded, readStoredViewerPrefs().options) : seeded;
	const listeners = new Set<ViewerOptionsListener>();

	function commit(next: ViewerOptions): void {
		options = next;
		if (persist) {
			writeStoredViewerPrefs({ options: diffViewerOptions(next) });
		}
		for (const listener of listeners) {
			listener(options);
		}
	}

	return {
		getOptions: () => options,
		setOptions: (next) => commit(cloneViewerOptions(next)),
		setValue: (group, key, value) => {
			const defaults = DEFAULT_VIEWER_OPTIONS[group] as unknown as Record<string, unknown>;
			if (!(key in defaults) || typeof defaults[key] !== typeof value) {
				return;
			}
			const next = cloneViewerOptions(options);
			(next[group] as unknown as Record<string, unknown>)[key] = value;
			commit(next);
		},
		getValue: (group, key) => {
			const record = options[group] as unknown as Record<string, unknown>;
			const value = record[key];
			return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
				? value
				: undefined;
		},
		setRibbonTabHidden: (tabId, hidden) => {
			if (tabId === 'file') {
				return;
			}
			const current = options.ribbon.hiddenTabIds;
			const has = current.includes(tabId);
			if (hidden === has) {
				return;
			}
			const next = cloneViewerOptions(options);
			next.ribbon.hiddenTabIds = hidden
				? [...current, tabId]
				: current.filter((id) => id !== tabId);
			commit(next);
		},
		setQuickAccessCommands: (commandIds) => {
			const next = cloneViewerOptions(options);
			next.quickAccess.commandIds = [...commandIds];
			commit(next);
		},
		reset: (group) => {
			if (!group) {
				commit(cloneViewerOptions(DEFAULT_VIEWER_OPTIONS));
				return;
			}
			const next = cloneViewerOptions(options);
			const defaults = cloneViewerOptions(DEFAULT_VIEWER_OPTIONS);
			(next as Record<ViewerOptionsGroupId, unknown>)[group] = defaults[group];
			commit(next);
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}

function overlayStored(
	base: ViewerOptions,
	stored: StoredViewerOptions | undefined,
): ViewerOptions {
	if (!stored) {
		return base;
	}
	const fromStored = mergeViewerOptions(stored);
	const merged = cloneViewerOptions(base);
	const diff = diffViewerOptions(fromStored);
	for (const groupId of Object.keys(diff) as ViewerOptionsGroupId[]) {
		const patch = diff[groupId];
		if (!patch) {
			continue;
		}
		Object.assign(merged[groupId] as unknown as Record<string, unknown>, patch);
	}
	return merged;
}
