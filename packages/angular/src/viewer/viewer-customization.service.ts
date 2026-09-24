/**
 * viewer-customization.service.ts: the per-viewer owner of the shared UI
 * customisation model (`ViewerCustomization`, see docs/guide/customization.md).
 *
 * Wraps ONE `createCustomizationController` per viewer instance behind an
 * Angular signal, so every render site (ribbon gates, File > Options, the File
 * tab, both right-click menus, the editor keymap, the chrome regions) reads the
 * same `ResolvedCustomization` reactively. It also pushes the resolved locks and
 * host defaults into the viewer's File > Options store on every change.
 *
 * No decision logic lives here: the helpers below only forward to the shared
 * pure functions, so Angular cannot drift from the other four bindings.
 *
 * Provided per viewer through `POWER_POINT_VIEWER_PROVIDERS`. Deep components
 * inject it optionally (see {@link injectResolvedCustomization}) so they keep
 * working when mounted outside a viewer, e.g. in unit tests.
 */

import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { EffectRef, ProviderToken, Signal } from '@angular/core';

import {
	createCustomizationController,
	EMPTY_RESOLVED_CUSTOMIZATION,
	isDialogAvailable,
	isFeatureEnabled,
	isPanelVisible,
	resolveEffectiveHiddenActions,
} from '../internal/shared';
import type {
	ResolvedCustomization,
	ToolbarActionId,
	ViewerCustomization,
	ViewerCustomizationApi,
	ViewerDialogId,
	ViewerFeatureId,
	ViewerPanelId,
	ViewerQuickAccessOptions,
} from '../internal/shared';
import { ViewerOptionsService } from './viewer-options.service';

/** `inject()` that tolerates a plain `new` outside an injection context. */
function tryInject<T>(token: ProviderToken<T>): T | null {
	try {
		return inject(token, { optional: true });
	} catch {
		return null;
	}
}

@Injectable()
export class ViewerCustomizationService {
	private readonly destroyRef = tryInject(DestroyRef);
	private readonly viewerOptions = tryInject(ViewerOptionsService);
	private readonly controller = createCustomizationController();

	/** The imperative helpers every binding's public handle exposes. */
	readonly api: ViewerCustomizationApi = this.controller.api;

	private readonly _resolved = signal<ResolvedCustomization>(this.controller.getResolved());
	/** The normalised customisation the render sites read. */
	readonly resolved: Signal<ResolvedCustomization> = this._resolved.asReadonly();

	constructor() {
		this.applyConstraints();
		const unsubscribe = this.controller.subscribe(() => {
			this._resolved.set(this.controller.getResolved());
			this.applyConstraints();
		});
		this.destroyRef?.onDestroy(unsubscribe);
	}

	/**
	 * Follow the host's `customization` input: each new object identity
	 * REPLACES the customisation (including any imperative edits). The initial
	 * `undefined` is not applied, so edits made before the first change
	 * detection survive. Must be called from an injection context.
	 */
	bindInput(source: () => ViewerCustomization | undefined): EffectRef {
		let last: ViewerCustomization | undefined;
		return effect(() => {
			const next = source();
			if (next === last) {
				return;
			}
			last = next;
			untracked(() => this.api.setCustomization(next ?? {}));
		});
	}

	/** The legacy `hiddenActions` list unioned with the customisation. */
	effectiveHiddenActions(legacy: readonly ToolbarActionId[]): ToolbarActionId[] {
		return resolveEffectiveHiddenActions(this.resolved(), legacy) ?? [];
	}

	panelVisible(panel: ViewerPanelId): boolean {
		return isPanelVisible(this.resolved(), panel);
	}

	featureEnabled(feature: ViewerFeatureId): boolean {
		return isFeatureEnabled(this.resolved(), feature);
	}

	dialogAvailable(dialog: ViewerDialogId): boolean {
		return isDialogAvailable(this.resolved(), dialog);
	}

	/** The Quick Access options, switched off when the host hid the strip. */
	quickAccess(options: ViewerQuickAccessOptions): ViewerQuickAccessOptions {
		return this.panelVisible('quickAccessToolbar') ? options : { ...options, visible: false };
	}

	private applyConstraints(): void {
		const resolved = this.controller.getResolved();
		this.viewerOptions?.store.setConstraints({
			locked: resolved.lockedSettings,
			defaults: resolved.defaultSettings,
		});
	}
}

const EMPTY_RESOLVED = signal(EMPTY_RESOLVED_CUSTOMIZATION).asReadonly();

/**
 * The viewer's resolved customisation, or the empty one when the component is
 * mounted outside a viewer. Call from an injection context.
 */
export function injectResolvedCustomization(): Signal<ResolvedCustomization> {
	return inject(ViewerCustomizationService, { optional: true })?.resolved ?? EMPTY_RESOLVED;
}
