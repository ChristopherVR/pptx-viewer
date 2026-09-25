/**
 * useViewerCustomization: owns the per-viewer UI customisation controller.
 *
 * Vue counterpart of the React `useSyncExternalStore` wiring. One shared
 * `createCustomizationController` per viewer instance holds the host's
 * `ViewerCustomization` (the `customization` prop seeds it and REPLACES it
 * whenever the prop changes identity; the imperative helpers on the component
 * handle edit it in between). The resolved view is mirrored into a
 * `shallowRef` and provided under {@link ViewerCustomizationKey}, so deep
 * chrome (the Settings dialog, the File tab, the title bar) reads it through
 * `inject` instead of a new prop threaded through every level.
 *
 * Every decision (which tab, page, command or panel survives) is made by the
 * pure functions in `pptx-viewer-shared`'s `render/customization`; this file
 * only wires the store to Vue reactivity and to the File > Options store.
 */
import {
	createCustomizationController,
	EMPTY_RESOLVED_CUSTOMIZATION,
	isDialogAvailable,
	isFeatureEnabled,
	isPanelVisible,
	resolveEffectiveHiddenActions,
} from 'pptx-viewer-shared';
import type {
	ResolvedCustomization,
	ToolbarActionId,
	ViewerCustomization,
	ViewerCustomizationApi,
	ViewerCustomizationController,
	ViewerDialogId,
	ViewerFeatureId,
	ViewerOptionsStore,
	ViewerPanelId,
} from 'pptx-viewer-shared';
import type { PptxAiConfig } from 'pptx-viewer-shared/ai';
import { computed, inject, onScopeDispose, provide, shallowRef, watch } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';

/** Reactive resolved customisation, provided by `PowerPointViewer`. */
export const ViewerCustomizationKey: InjectionKey<ShallowRef<ResolvedCustomization>> =
	Symbol('pptxViewerCustomization');

export interface UseViewerCustomizationInput {
	/**
	 * The viewer's (reactive) props: `customization` seeds / replaces the
	 * state, the legacy `hiddenActions` is unioned into the result, and `ai`
	 * is folded into the single AI gate.
	 */
	props: {
		readonly customization?: ViewerCustomization;
		readonly hiddenActions?: readonly ToolbarActionId[];
		readonly ai?: PptxAiConfig;
	};
	/** The viewer's File > Options store; receives the locks and host defaults. */
	optionsStore: ViewerOptionsStore;
}

export interface UseViewerCustomizationResult {
	controller: ViewerCustomizationController;
	/** The imperative helpers, ready to spread onto the `defineExpose` handle. */
	api: ViewerCustomizationApi;
	/** The resolved customisation; a new object per change. */
	resolved: ShallowRef<ResolvedCustomization>;
	/** Legacy `hiddenActions` unioned with the customisation's ribbon/dialog/feature rules. */
	effectiveHiddenActions: ComputedRef<ToolbarActionId[] | undefined>;
	/** The one AI gate: the host passed `ai` AND did not switch the feature off. */
	aiEnabled: ComputedRef<boolean>;
	/** The host's `ai` config while {@link aiEnabled}, else `undefined`. */
	aiConfig: ComputedRef<PptxAiConfig | undefined>;
	panelVisible: (panel: ViewerPanelId) => boolean;
	featureEnabled: (feature: ViewerFeatureId) => boolean;
	dialogAvailable: (dialog: ViewerDialogId) => boolean;
}

function applyConstraints(store: ViewerOptionsStore, resolved: ResolvedCustomization): void {
	store.setConstraints({ locked: resolved.lockedSettings, defaults: resolved.defaultSettings });
}

export function useViewerCustomization(
	input: UseViewerCustomizationInput,
): UseViewerCustomizationResult {
	const { props } = input;
	const controller = createCustomizationController(props.customization);
	const resolved = shallowRef(controller.getResolved());
	applyConstraints(input.optionsStore, resolved.value);

	const unsubscribe = controller.subscribe(() => {
		const next = controller.getResolved();
		if (next === resolved.value) {
			return;
		}
		resolved.value = next;
		applyConstraints(input.optionsStore, next);
	});
	onScopeDispose(unsubscribe);

	// The prop replaces imperative edits whenever the host hands in a new object.
	watch(
		() => props.customization,
		(next) => controller.api.setCustomization(next ?? {}),
	);

	provide(ViewerCustomizationKey, resolved);

	const aiEnabled = computed(() => Boolean(props.ai) && isFeatureEnabled(resolved.value, 'ai'));
	return {
		controller,
		api: controller.api,
		resolved,
		effectiveHiddenActions: computed(() =>
			resolveEffectiveHiddenActions(resolved.value, props.hiddenActions),
		),
		aiEnabled,
		aiConfig: computed(() => (aiEnabled.value ? props.ai : undefined)),
		panelVisible: (panel) => isPanelVisible(resolved.value, panel),
		featureEnabled: (feature) => isFeatureEnabled(resolved.value, feature),
		dialogAvailable: (dialog) => isDialogAvailable(resolved.value, dialog),
	};
}

/**
 * The resolved customisation for a component below `PowerPointViewer`. Falls
 * back to "customise nothing" when rendered standalone (unit tests, a host
 * mounting a sub-component directly).
 */
export function useResolvedCustomization(): ShallowRef<ResolvedCustomization> {
	return inject(ViewerCustomizationKey, () => shallowRef(EMPTY_RESOLVED_CUSTOMIZATION), true);
}
