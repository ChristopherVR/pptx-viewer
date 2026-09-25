/**
 * useViewerCustomization: the per-viewer host UI customisation store.
 *
 * Owns ONE shared `createCustomizationController` per `PowerPointViewer`
 * instance, feeds the `customization` prop into it whenever the prop changes
 * identity (the prop replaces any imperative edits made through the handle),
 * exposes the resolved view reactively through `useSyncExternalStore`, and
 * pushes the host's locked settings and defaults into the File > Options
 * store. Every decision is made by the shared `render/customization` module;
 * this hook is only the React wiring around it.
 */
import type {
	ResolvedCustomization,
	ToolbarActionId,
	ViewerCustomization,
	ViewerCustomizationApi,
	ViewerCustomizationController,
	ViewerOptionsStore,
} from 'pptx-viewer-shared';
import { createCustomizationController, resolveEffectiveHiddenActions } from 'pptx-viewer-shared';
import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react';

export interface ViewerCustomizationResult {
	/** The resolved customisation every render site reads. */
	resolved: ResolvedCustomization;
	/** The imperative helpers spread onto the component handle. */
	api: ViewerCustomizationApi;
	/** The legacy `hiddenActions` prop unioned with the customisation. */
	hiddenActions: ToolbarActionId[] | undefined;
}

export function useViewerCustomization(
	customization: ViewerCustomization | undefined,
	legacyHiddenActions: ToolbarActionId[] | undefined,
	optionsStore: ViewerOptionsStore,
): ViewerCustomizationResult {
	const controllerRef = useRef<ViewerCustomizationController | null>(null);
	controllerRef.current ??= createCustomizationController(customization);
	const controller = controllerRef.current;

	// A new `customization` object replaces the whole customisation. Compared
	// by identity so the seed passed to the controller above is not re-applied
	// on mount (and a StrictMode double-invoke is a no-op).
	const appliedRef = useRef(customization);
	useLayoutEffect(() => {
		if (appliedRef.current === customization) {
			return;
		}
		appliedRef.current = customization;
		controller.api.setCustomization(customization ?? {});
	}, [controller, customization]);

	const resolved = useSyncExternalStore(
		controller.subscribe,
		controller.getResolved,
		controller.getResolved,
	);

	// Locks and host defaults go into the options store on mount and whenever
	// they change. Compared by their serialised form so an unrelated edit
	// (hiding a ribbon tab) does not rebase the options store.
	const appliedConstraintsRef = useRef<string | null>(null);
	useLayoutEffect(() => {
		const key = JSON.stringify([resolved.lockedSettings, resolved.defaultSettings]);
		if (appliedConstraintsRef.current === key) {
			return;
		}
		appliedConstraintsRef.current = key;
		optionsStore.setConstraints({
			locked: resolved.lockedSettings,
			defaults: resolved.defaultSettings,
		});
	}, [optionsStore, resolved]);

	const hiddenActions = useMemo(
		() => resolveEffectiveHiddenActions(resolved, legacyHiddenActions),
		[resolved, legacyHiddenActions],
	);

	return { resolved, api: controller.api, hiddenActions };
}
