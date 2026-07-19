import type {
	PrintSettings,
	ToolbarTabId,
	ViewerOptionPrimitive,
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsStore,
	ViewerOptionsStoreInit,
	ViewerPreferences,
} from 'pptx-viewer-shared';
import {
	applyPreferenceToOptions,
	createViewerOptionsStore,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	playFeedbackSound,
	resolveAutosaveIntervalSeconds,
	resolveDefaultPrintSettings,
	resolveHistoryDepth,
	resolveOptionRootClasses,
	resolveScreenTip,
	shouldConfirmExternalHyperlink,
	viewerOptionsToPreferences,
} from 'pptx-viewer-shared';

/**
 * ViewerOptionsState: the runes wrapper around the shared File > Options
 * store. Owns the reactive `options` snapshot (updated via the store's
 * subscribe callback, persisted by the store to the shared
 * `pptx-viewer-prefs` localStorage entry) plus the derived behavior values
 * the viewer wires: history depth, ribbon visibility, print defaults,
 * screen tips, root classes, trust gates, and feedback sounds.
 */
export class ViewerOptionsState {
	/** Reactive File > Options snapshot; a new object per change. */
	options = $state.raw<ViewerOptions>(undefined as unknown as ViewerOptions);

	readonly #store: ViewerOptionsStore;
	readonly #unsubscribe: () => void;

	constructor(init?: ViewerOptionsStoreInit) {
		this.#store = createViewerOptionsStore(init);
		this.options = this.#store.getOptions();
		this.#unsubscribe = this.#store.subscribe((next) => {
			this.options = next;
		});
	}

	/** The legacy six-toggle projection of the current options. */
	get preferences(): ViewerPreferences {
		return viewerOptionsToPreferences(this.options);
	}

	/** Undo depth for the editor history (Advanced > maximum undos). */
	get historyDepth(): number {
		return resolveHistoryDepth(this.options);
	}

	/** Ribbon tabs unticked in Customize Ribbon (File never hides). */
	get hiddenRibbonTabIds(): readonly ToolbarTabId[] {
		return this.options.ribbon.hiddenTabIds.filter((id) => id !== 'file');
	}

	/** Print dialog seed, or undefined for "use most recent settings". */
	get printDefaults(): Partial<PrintSettings> | undefined {
		return resolveDefaultPrintSettings(this.options);
	}

	/** Viewer-root CSS classes reflecting display-affecting options. */
	get rootClasses(): string[] {
		return resolveOptionRootClasses(this.options, 'pptx');
	}

	setValue(group: ViewerOptionsGroupId, key: string, value: ViewerOptionPrimitive): void {
		this.#store.setValue(group, key, value);
	}

	/** Restore a snapshot wholesale (the dialog's Cancel semantics). */
	restore(snapshot: ViewerOptions): void {
		this.#store.setOptions(snapshot);
	}

	setRibbonTabHidden(tabId: ToolbarTabId, hidden: boolean): void {
		this.#store.setRibbonTabHidden(tabId, hidden);
	}

	setQuickAccessCommands(commandIds: readonly string[]): void {
		this.#store.setQuickAccessCommands(commandIds);
	}

	reset(group?: ViewerOptionsGroupId): void {
		this.#store.reset(group);
	}

	/**
	 * Push the legacy preference toggles (ribbon View tab, title-bar autosave)
	 * back into the options model. Only writes when a value actually differs,
	 * so the bidirectional sync with `preferences` cannot loop.
	 */
	applyPreferences(prefs: ViewerPreferences): void {
		const mapped = viewerOptionsToPreferences(this.options);
		let next = this.options;
		for (const key of Object.keys(mapped) as (keyof ViewerPreferences)[]) {
			if (mapped[key] !== prefs[key]) {
				next = applyPreferenceToOptions(next, key, prefs[key]);
			}
		}
		if (next !== this.options) {
			this.#store.setOptions(next);
		}
	}

	/** Tooltip text under the current ScreenTip style, or undefined for none. */
	screenTip(label: string, description?: string, shortcut?: string): string | undefined {
		return resolveScreenTip(this.options, label, description, shortcut);
	}

	/**
	 * Trust Center gate for following an external hyperlink. Returns true when
	 * navigation may proceed (gate off, non-http(s) target, or confirmed).
	 */
	confirmHyperlink(href: string, message: string): boolean {
		if (!shouldConfirmExternalHyperlink(this.options, href)) {
			return true;
		}
		return typeof window === 'undefined' ? true : window.confirm(`${message}\n\n${href}`);
	}

	/** Accessibility > "feedback with sound" cue for a completed action. */
	playFeedback(): void {
		playFeedbackSound(this.options);
	}

	/**
	 * Autosave debounce in ms: the host prop until the user picks a custom
	 * AutoRecover cadence in Options > Save, which then takes over.
	 */
	autosaveDebounceMs(hostIntervalMs: number, defaultMinutes: number): number {
		return this.options.save.autoRecoverIntervalMinutes === defaultMinutes
			? hostIntervalMs
			: resolveAutosaveIntervalSeconds(this.options) * 1000;
	}

	/** Options > Save > "Delete cached files": drop all recovery snapshots. */
	async clearCache(): Promise<void> {
		const snapshots = await listAutosaveSnapshots();
		await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
	}

	dispose(): void {
		this.#unsubscribe();
	}
}
