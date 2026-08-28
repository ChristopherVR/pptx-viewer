import type {
	ToolbarTabId,
	ViewerOptions,
	ViewerOptionsStore,
	ViewerOptionsStoreInit,
} from 'pptx-viewer-shared';
import {
	applyAutoCorrect,
	applyPreferenceToOptions,
	createViewerOptionsStore,
	playFeedbackSound,
	resolveAutosaveIntervalSeconds,
	resolveHistoryDepth,
	resolveOptionRootClasses,
	resolveScreenTip,
	shouldOpenInProtectedView,
	viewerOptionsToPreferences,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from './state';

/**
 * Owns the File > Options store for one viewer instance and translates option
 * values into behavior: the six legacy view toggles (kept in sync both ways,
 * mirroring React's guarded bidirectional sync), option-driven root classes,
 * undo depth, AutoRecover cadence, ribbon tab visibility, the Quick Access
 * strip, ScreenTips, AutoCorrect, protected view, and feedback sounds.
 */

/** Every root class `resolveOptionRootClasses(options, 'pptxv')` may emit. */
const OPTION_ROOT_CLASSES = ['pptxv-reduced-motion', 'pptxv-no-hw-accel', 'pptxv-compat-display'];

/** Viewer-state keys mirrored into the options model (legacy toggle bridge). */
const STATE_PREF_KEYS = [
	['showGrid', 'showGrid'],
	['showRulers', 'showRulers'],
	['snapToGrid', 'snapToGrid'],
	['spellCheckEnabled', 'spellCheck'],
] as const;

export interface ViewerOptionsHost {
	store: Store<ViewerState>;
	/** The mounted `.pptxv` root, or null before the chrome exists. */
	root(): HTMLElement | null;
	isAutosaveEnabled(): boolean;
	setAutosaveEnabled(enabled: boolean): void;
	setAutosaveIntervalMs(ms: number): void;
	setHistoryDepth(depth: number): void;
	setRibbonHiddenTabs(tabIds: readonly ToolbarTabId[]): void;
	refreshQuickAccess(): void;
	applyScreenTips(): void;
	/**
	 * Re-render the current slide. Needed so toggling Advanced > "Disable 3D
	 * rendering" takes effect on the live canvas immediately: the six 3D
	 * flag getters are read fresh on every render, but nothing re-renders on
	 * its own just because an option changed.
	 */
	renderStage(): void;
}

export interface ViewerOptionsController {
	optionsStore: ViewerOptionsStore;
	getOptions(): ViewerOptions;
	/** (Re)apply every option-driven behavior; call after each chrome mount. */
	applyAll(): void;
	screenTip(label: string, description?: string, shortcut?: string): string | undefined;
	/** AutoCorrect for committed text runs (Options > Proofing). */
	transformCommittedText(text: string): string;
	/** Accessibility > "feedback with sound" cue after a completed action. */
	notifyActionSuccess(): void;
	/** Mirror a title-bar/host autosave toggle back into the options model. */
	notifyAutosaveEnabled(enabled: boolean): void;
	/** Trust Center > "open documents in protected view". */
	isProtectedView(): boolean;
	dispose(): void;
}

export function createViewerOptionsController(
	host: ViewerOptionsHost,
	init?: ViewerOptionsStoreInit,
): ViewerOptionsController {
	const optionsStore = createViewerOptionsStore(init);
	let syncing = false;

	const applyBehavior = (options: ViewerOptions): void => {
		syncing = true;
		try {
			const prefs = viewerOptionsToPreferences(options);
			const state = host.store.get();
			const patch: Partial<ViewerState> = {};
			for (const [stateKey, prefKey] of STATE_PREF_KEYS) {
				if (state[stateKey] !== prefs[prefKey]) {
					patch[stateKey] = prefs[prefKey];
				}
			}
			if (Object.keys(patch).length > 0) {
				host.store.set(patch);
			}
			const root = host.root();
			if (root) {
				// View toggles reuse the same camelCase classes `toggleViewOption` sets.
				root.classList.toggle('pptxv-showGrid', prefs.showGrid);
				root.classList.toggle('pptxv-showRulers', prefs.showRulers);
				root.classList.toggle('pptxv-snapToGrid', prefs.snapToGrid);
				const active = new Set(resolveOptionRootClasses(options, 'pptxv'));
				for (const className of OPTION_ROOT_CLASSES) {
					root.classList.toggle(className, active.has(className));
				}
				root.classList.toggle('pptxv-no-show-popup', !options.advanced.slideShowShowPopupToolbar);
			}
			if (host.isAutosaveEnabled() !== prefs.autoSave) {
				host.setAutosaveEnabled(prefs.autoSave);
			}
			// The AutoRecover cadence is now the binding's cadence, not an override
			// of a private fast debounce: it is pushed on every options change, and
			// the shared `resolveAutosaveIntervalMs` still lets an explicit
			// `autosaveIntervalMs` option outrank it.
			host.setAutosaveIntervalMs(resolveAutosaveIntervalSeconds(options) * 1000);
			host.setHistoryDepth(resolveHistoryDepth(options));
			host.setRibbonHiddenTabs(options.ribbon.hiddenTabIds);
			host.refreshQuickAccess();
			host.applyScreenTips();
			host.renderStage();
		} finally {
			syncing = false;
		}
	};

	const unsubscribeOptions = optionsStore.subscribe(applyBehavior);

	// Legacy state -> options (ribbon View toggles, spell check, etc.).
	const unsubscribeState = host.store.subscribe((state, previous) => {
		if (syncing) {
			return;
		}
		let next = optionsStore.getOptions();
		let changed = false;
		for (const [stateKey, prefKey] of STATE_PREF_KEYS) {
			if (
				state[stateKey] !== previous[stateKey] &&
				viewerOptionsToPreferences(next)[prefKey] !== state[stateKey]
			) {
				next = applyPreferenceToOptions(next, prefKey, state[stateKey]);
				changed = true;
			}
		}
		if (changed) {
			optionsStore.setOptions(next);
		}
	});

	return {
		optionsStore,
		getOptions: () => optionsStore.getOptions(),
		applyAll: () => applyBehavior(optionsStore.getOptions()),
		screenTip: (label, description, shortcut) =>
			resolveScreenTip(optionsStore.getOptions(), label, description, shortcut),
		transformCommittedText: (text) => applyAutoCorrect(text, optionsStore.getOptions().proofing),
		notifyActionSuccess: () => playFeedbackSound(optionsStore.getOptions()),
		notifyAutosaveEnabled(enabled) {
			if (!syncing && optionsStore.getOptions().save.autoSave !== enabled) {
				optionsStore.setValue('save', 'autoSave', enabled);
			}
		},
		isProtectedView: () => shouldOpenInProtectedView(optionsStore.getOptions()),
		dispose() {
			unsubscribeOptions();
			unsubscribeState();
		},
	};
}
