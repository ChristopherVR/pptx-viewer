import {
	EMPTY_RESOLVED_CUSTOMIZATION,
	createCustomizationController,
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
	ViewerPanelId,
} from 'pptx-viewer-shared';
import { getContext, onDestroy, setContext, untrack } from 'svelte';

/**
 * The read side every render site consumes: the resolved customisation plus
 * thin, reactive shortcuts onto the shared decision functions. Reading any
 * getter inside a template or `$derived` tracks `resolved`, so an imperative
 * `hideRibbonTab(...)` re-renders exactly the chrome that depends on it.
 */
export interface ViewerCustomizationReader {
	readonly resolved: ResolvedCustomization;
	isPanelVisible(panel: ViewerPanelId): boolean;
	isFeatureEnabled(feature: ViewerFeatureId): boolean;
	isDialogAvailable(dialog: ViewerDialogId): boolean;
}

/**
 * ViewerCustomizationState: the runes wrapper around the shared per-viewer
 * customisation controller. One per `PowerPointViewer` instance; the root
 * subscribes to the controller and mirrors `getResolved()` into `$state` so
 * every consumer is reactive without its own subscription.
 */
export class ViewerCustomizationState implements ViewerCustomizationReader {
	resolved = $state.raw<ResolvedCustomization>(EMPTY_RESOLVED_CUSTOMIZATION);

	readonly controller: ViewerCustomizationController;
	readonly #unsubscribe: () => void;

	constructor(initial?: ViewerCustomization) {
		this.controller = createCustomizationController(initial);
		this.resolved = this.controller.getResolved();
		this.#unsubscribe = this.controller.subscribe(() => {
			this.resolved = this.controller.getResolved();
		});
	}

	/** The imperative helpers the component instance re-exports. */
	get api(): ViewerCustomizationApi {
		return this.controller.api;
	}

	isPanelVisible(panel: ViewerPanelId): boolean {
		return isPanelVisible(this.resolved, panel);
	}

	isFeatureEnabled(feature: ViewerFeatureId): boolean {
		return isFeatureEnabled(this.resolved, feature);
	}

	isDialogAvailable(dialog: ViewerDialogId): boolean {
		return isDialogAvailable(this.resolved, dialog);
	}

	destroy(): void {
		this.#unsubscribe();
	}
}

/**
 * The `hiddenActions` list the chrome gates read: the host's legacy prop and
 * the customisation (via the shared `resolveEffectiveHiddenActions`), plus
 * the tabs the user unticked in File > Options > Customize Ribbon.
 */
export function effectiveHiddenActions(
	resolved: ResolvedCustomization,
	legacy: readonly ToolbarActionId[] | undefined,
	ribbonHiddenTabs: readonly ToolbarActionId[],
): ToolbarActionId[] {
	return [...(resolveEffectiveHiddenActions(resolved, legacy) ?? []), ...ribbonHiddenTabs];
}

let ribbonScopeCounter = 0;

/**
 * A fresh per-viewer `data-pptx-ribbon-scope` token, so the generated ribbon
 * customisation rules only reach this viewer's own ribbon.
 */
export function nextRibbonScopeToken(): string {
	ribbonScopeCounter += 1;
	return `pptx-svelte-${ribbonScopeCounter}`;
}

const VIEWER_CUSTOMIZATION_CONTEXT_KEY = Symbol('pptx-svelte-viewer-customization');

/** The reader for a subtree with no provider: "customise nothing". */
const DEFAULT_READER: ViewerCustomizationReader = {
	resolved: EMPTY_RESOLVED_CUSTOMIZATION,
	isPanelVisible: () => true,
	isFeatureEnabled: () => true,
	isDialogAvailable: () => true,
};

/** Provide a reader to the component subtree (root, or a test harness). */
export function provideViewerCustomization(reader: ViewerCustomizationReader): void {
	setContext(VIEWER_CUSTOMIZATION_CONTEXT_KEY, reader);
}

/**
 * Consume the nearest provided customisation. Falls back to the empty
 * customisation, so components mounted stand-alone (tests) render stock UI.
 */
export function useViewerCustomization(): ViewerCustomizationReader {
	return (
		getContext<ViewerCustomizationReader | undefined>(VIEWER_CUSTOMIZATION_CONTEXT_KEY) ??
		DEFAULT_READER
	);
}

/** A context map carrying `reader`, for `mount(Component, { context })` in tests. */
export function customizationContext(reader: ViewerCustomizationReader): Map<symbol, unknown> {
	return new Map<symbol, unknown>([[VIEWER_CUSTOMIZATION_CONTEXT_KEY, reader]]);
}

/**
 * Root wiring: build the per-viewer state seeded from the `customization`
 * prop, publish it via context, and follow the prop's identity (a new object
 * replaces the whole customisation, including imperative edits). Must run
 * synchronously in the root component's script.
 */
export function useViewerCustomizationRoot(
	getCustomization: () => ViewerCustomization | undefined,
): ViewerCustomizationState {
	const initial = untrack(getCustomization);
	const state = new ViewerCustomizationState(initial);
	provideViewerCustomization(state);
	let last = initial;
	$effect.pre(() => {
		const next = getCustomization();
		if (next === last) {
			return;
		}
		last = next;
		untrack(() => state.api.setCustomization(next ?? {}));
	});
	onDestroy(() => state.destroy());
	return state;
}

/** The options store surface `useCustomizationConstraints` drives. */
export interface ConstrainableOptions {
	setConstraints(constraints: {
		locked?: ResolvedCustomization['lockedSettings'];
		defaults?: ResolvedCustomization['defaultSettings'];
	}): void;
}

/**
 * Keep the File > Options store's host locks and defaults in step with the
 * resolved customisation: applied once synchronously (so the first render
 * already shows locked values) and again on every change.
 */
export function useCustomizationConstraints(
	state: ViewerCustomizationReader,
	options: ConstrainableOptions,
): void {
	// Keyed on the serialised pair so a customisation change that leaves the
	// locks and defaults alone (a hidden ribbon tab) never rewrites the store.
	const keyOf = (resolved: ResolvedCustomization): string =>
		JSON.stringify([resolved.lockedSettings, resolved.defaultSettings]);
	const apply = (resolved: ResolvedCustomization): void =>
		options.setConstraints({ locked: resolved.lockedSettings, defaults: resolved.defaultSettings });
	let appliedKey = untrack(() => keyOf(state.resolved));
	untrack(() => apply(state.resolved));
	$effect.pre(() => {
		const resolved = state.resolved;
		const key = keyOf(resolved);
		if (key === appliedKey) {
			return;
		}
		appliedKey = key;
		untrack(() => apply(resolved));
	});
}
