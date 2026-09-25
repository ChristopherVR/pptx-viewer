/**
 * The vanilla wiring of the shared UI customisation model
 * (`pptx-viewer-shared/render/customization`).
 *
 * One controller per viewer. Every decision (which tab, page, card, menu entry,
 * shortcut or panel survives) is made by the shared resolver and decision
 * functions; this module only maps the resolved descriptor onto the pieces the
 * vanilla chrome already consumes (its `PptxViewerOptions` flags, the chrome
 * panel flags, the Quick Access strip state), pushes the lock/default
 * constraints into the File > Options store, and tells the viewer to rebuild
 * its chrome when the customisation changes. Menus, the keyboard and the
 * Settings dialog read `getResolved()` lazily at open / keypress time, so they
 * need no rebuild of their own.
 *
 * @module viewer/customization-lifecycle
 */
import {
	createCustomizationController,
	isDialogAvailable,
	isFeatureEnabled,
	isPanelVisible,
	resolveEffectiveHiddenActions,
} from 'pptx-viewer-shared';
import type {
	ResolvedCustomization,
	ViewerCustomizationController,
	ViewerDialogId,
	ViewerOptionsStore,
} from 'pptx-viewer-shared';

import type { PptxViewerOptions } from './types';

/**
 * The chrome regions `buildViewerChrome` gates beyond the host's own flags
 * (the Quick Access strip is gated through {@link customizeQuickAccessState}).
 */
export interface ChromePanelFlags {
	showTitleBar: boolean;
	showStatusBar: boolean;
	showNotes: boolean;
}

/** Map the resolved panel set onto the chrome's region flags. */
export function resolveChromePanelFlags(resolved: ResolvedCustomization): ChromePanelFlags {
	return {
		showTitleBar: isPanelVisible(resolved, 'titleBar'),
		showStatusBar: isPanelVisible(resolved, 'statusBar'),
		showNotes: isPanelVisible(resolved, 'notes'),
	};
}

/**
 * The Quick Access strip state after the customisation: the whole strip goes
 * when its panel is hidden, and the Print command goes with the Print dialog.
 */
export function customizeQuickAccessState<
	T extends { visible: boolean; commandIds: readonly string[] },
>(state: T, resolved: ResolvedCustomization): T {
	const visible = state.visible && isPanelVisible(resolved, 'quickAccessToolbar');
	const commandIds = isDialogAvailable(resolved, 'print')
		? state.commandIds
		: state.commandIds.filter((id) => id !== 'print');
	return { ...state, visible, commandIds };
}

export interface ViewerCustomizationLifecycle {
	readonly controller: ViewerCustomizationController;
	/** The current resolved customisation (read lazily by every render site). */
	getResolved(): ResolvedCustomization;
	/**
	 * The host options with the customisation folded into the flags the chrome
	 * builders already read: `hiddenActions` (legacy list unioned with the
	 * customisation), `showThumbnails` and `showInspector`.
	 */
	getChromeOptions(): PptxViewerOptions;
	/** The host configured `ai` AND the customisation keeps the AI feature. */
	isAiEnabled(): boolean;
	isDialogAvailable(dialog: ViewerDialogId): boolean;
	/**
	 * Start applying the customisation: push the constraints into the options
	 * store now and on every change, and call `onChange` after each change so
	 * the viewer can rebuild its chrome.
	 */
	bind(optionsStore: ViewerOptionsStore, onChange: () => void): void;
	destroy(): void;
}

export function createViewerCustomizationLifecycle(
	options: PptxViewerOptions,
): ViewerCustomizationLifecycle {
	const controller = createCustomizationController(options.customization);
	let cachedFor: ResolvedCustomization | null = null;
	let cachedOptions: PptxViewerOptions = options;
	let unsubscribe: (() => void) | null = null;

	const getChromeOptions = (): PptxViewerOptions => {
		const resolved = controller.getResolved();
		if (cachedFor !== resolved) {
			cachedFor = resolved;
			cachedOptions = {
				...options,
				hiddenActions: resolveEffectiveHiddenActions(resolved, options.hiddenActions),
				showThumbnails: (options.showThumbnails ?? true) && isPanelVisible(resolved, 'slidesPane'),
				showInspector: (options.showInspector ?? true) && isPanelVisible(resolved, 'inspector'),
			};
		}
		return cachedOptions;
	};

	const applyConstraints = (store: ViewerOptionsStore): void => {
		const resolved = controller.getResolved();
		store.setConstraints({ locked: resolved.lockedSettings, defaults: resolved.defaultSettings });
	};

	return {
		controller,
		getResolved: () => controller.getResolved(),
		getChromeOptions,
		isAiEnabled: () => options.ai !== undefined && isFeatureEnabled(controller.getResolved(), 'ai'),
		isDialogAvailable: (dialog) => isDialogAvailable(controller.getResolved(), dialog),
		bind(optionsStore, onChange) {
			unsubscribe?.();
			applyConstraints(optionsStore);
			unsubscribe = controller.subscribe(() => {
				applyConstraints(optionsStore);
				onChange();
			});
		},
		destroy() {
			unsubscribe?.();
			unsubscribe = null;
		},
	};
}
