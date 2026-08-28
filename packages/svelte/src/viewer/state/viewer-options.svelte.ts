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
	resolveExpiredAutosaveSnapshots,
	resolveHistoryDepth,
	resolveOptionRootClasses,
	resolveScreenTip,
	shouldClearAutosaveCacheOnClose,
	shouldConfirmExternalHyperlink,
	shouldDiscardAutosaveOnSuccessfulSave,
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
		return resolveOptionRootClasses(this.options, 'pptx-svelte');
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
	 * Options > Save > "Save AutoRecover information every N minutes", in
	 * seconds. The autosave cadence whenever the host passed no explicit
	 * `autosaveIntervalMs`; the host-vs-user precedence itself is decided by
	 * `resolveAutosaveIntervalMs` in shared, not re-invented here.
	 */
	get autosaveIntervalSeconds(): number {
		return resolveAutosaveIntervalSeconds(this.options);
	}

	/** Options > Save > "Delete cached files": drop all recovery snapshots. */
	async clearCache(): Promise<void> {
		const snapshots = await listAutosaveSnapshots();
		await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
	}

	/**
	 * Options > Save > "keep the last AutoRecover version": whether a
	 * successful `.pptx` save should discard the AutoRecover snapshot for the
	 * deck just saved (the real file on disk already has the work, so the
	 * snapshot is stale unless the user asked to keep it).
	 */
	get shouldDiscardAutosaveOnSave(): boolean {
		return shouldDiscardAutosaveOnSuccessfulSave(this.options);
	}

	/** Options > Save > "clear cache on close": whether to wipe snapshots now. */
	get shouldClearCacheOnClose(): boolean {
		return shouldClearAutosaveCacheOnClose(this.options);
	}

	/** Options > Save > "cache retention": prune snapshots older than N days. */
	async pruneExpiredCache(): Promise<void> {
		const snapshots = await listAutosaveSnapshots();
		const expired = resolveExpiredAutosaveSnapshots(snapshots, this.options);
		await Promise.all(expired.map((key) => deleteAutosaveSnapshot(key)));
	}

	dispose(): void {
		this.#unsubscribe();
	}
}
