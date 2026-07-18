import type { ViewerOptions, ViewerOptionsStore } from 'pptx-viewer-shared';
import { createViewerOptionsStore, resolveScreenTip } from 'pptx-viewer-shared';
import { onScopeDispose, provide, shallowRef } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';

/**
 * useViewerOptionsStore: owns the File > Options store for a viewer instance.
 *
 * Vue counterpart of the React `useViewerOptions` hook. The shared store
 * hydrates from (and persists to) the `pptx-viewer-prefs` localStorage entry,
 * so choices survive reloads without any host wiring. The reactive snapshot is
 * also provided under {@link ViewerOptionsKey} so deep chrome components (the
 * File backstage, the ribbon tab bar) can read option values without threading
 * them through every prop contract, and a ScreenTip resolver is provided under
 * {@link ScreenTipKey} for `title` attributes on chrome controls.
 */

/** Reactive File > Options snapshot, provided by `PowerPointViewer`. */
export const ViewerOptionsKey: InjectionKey<ShallowRef<ViewerOptions>> =
	Symbol('pptxViewerOptions');

/** Tooltip text resolver honoring Options > General > ScreenTip style. */
export type ScreenTipResolver = (
	label: string,
	description?: string,
	shortcut?: string,
) => string | undefined;

/** ScreenTip resolver, provided by `PowerPointViewer` for chrome tooltips. */
export const ScreenTipKey: InjectionKey<ScreenTipResolver> = Symbol('pptxScreenTip');

export interface UseViewerOptionsStoreResult {
	/** Imperative store: `setValue`, `setRibbonTabHidden`, `reset`, ... */
	optionsStore: ViewerOptionsStore;
	/** Reactive snapshot; a new object per change, stable between changes. */
	viewerOptions: ShallowRef<ViewerOptions>;
}

export function useViewerOptionsStore(): UseViewerOptionsStoreResult {
	const optionsStore = createViewerOptionsStore();
	const viewerOptions = shallowRef(optionsStore.getOptions());
	const unsubscribe = optionsStore.subscribe((next) => {
		viewerOptions.value = next;
	});
	onScopeDispose(unsubscribe);

	provide(ViewerOptionsKey, viewerOptions);
	provide(ScreenTipKey, (label, description, shortcut) =>
		resolveScreenTip(viewerOptions.value, label, description, shortcut),
	);

	return { optionsStore, viewerOptions };
}
