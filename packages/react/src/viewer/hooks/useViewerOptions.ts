import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import { useRef, useSyncExternalStore } from 'react';

export interface UseViewerOptionsResult {
	/** Imperative store: `setValue`, `setRibbonTabHidden`, `reset`, ... */
	optionsStore: ViewerOptionsStore;
	/** Reactive snapshot; a new object per change, stable between changes. */
	options: ViewerOptions;
}

/**
 * Owns the File > Options store for a viewer instance. The store hydrates
 * from (and persists to) the shared `pptx-viewer-prefs` localStorage entry,
 * so choices survive reloads without any host wiring.
 */
export function useViewerOptions(): UseViewerOptionsResult {
	const storeRef = useRef<ViewerOptionsStore | null>(null);
	storeRef.current ??= createViewerOptionsStore();
	const store = storeRef.current;
	const options = useSyncExternalStore(
		(onStoreChange) => store.subscribe(onStoreChange),
		() => store.getOptions(),
		() => store.getOptions(),
	);
	return { optionsStore: store, options };
}
