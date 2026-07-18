/**
 * viewer-options.service.ts: signal-based owner of the File > Options store for
 * one viewer instance (the Angular counterpart of React's `useViewerOptions`).
 *
 * Wraps the framework-neutral {@link createViewerOptionsStore} (which persists a
 * sparse diff into the shared `pptx-viewer-prefs` localStorage entry) behind an
 * Angular signal, and bundles the option-to-behavior helpers the rest of the
 * viewer consumes: history depth, autosave cadence, print defaults, screen
 * tips, root classes, AutoCorrect, feedback sounds, hyperlink confirmation,
 * protected view, and the Options > Save cache purge.
 *
 * Deliberately constructible with plain `new` (no required injection context)
 * so the colocated unit tests can exercise it without TestBed, matching
 * {@link EditorStateService}'s optional-inject pattern.
 */

import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	applyAutoCorrect,
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
	shouldOpenInProtectedView,
} from '../internal/shared';
import type {
	PrintSettings,
	ToolbarTabId,
	ViewerOptionPrimitive,
	ViewerOptions,
	ViewerOptionsGroupId,
	ViewerOptionsStore,
} from '../internal/shared';

@Injectable()
export class ViewerOptionsService {
	/**
	 * Optional: `inject()` needs an active injection context, which plain
	 * `new ViewerOptionsService()` (used by the colocated unit tests) does not
	 * provide. Outside DI the subscription simply lives as long as the instance.
	 */
	private readonly destroyRef: DestroyRef | null = (() => {
		try {
			return inject(DestroyRef);
		} catch {
			return null;
		}
	})();

	private readonly translate: TranslateService | null = (() => {
		try {
			return inject(TranslateService);
		} catch {
			return null;
		}
	})();

	/** Imperative store: hydrates from and persists to `pptx-viewer-prefs`. */
	readonly store: ViewerOptionsStore = createViewerOptionsStore();

	private readonly _options = signal<ViewerOptions>(this.store.getOptions());
	/** Reactive File > Options snapshot; a new object per change. */
	readonly options = this._options.asReadonly();

	constructor() {
		const unsubscribe = this.store.subscribe((next) => this._options.set(next));
		this.destroyRef?.onDestroy(unsubscribe);
	}

	// ── Store mutations ─────────────────────────────────────────────────────

	setValue(group: ViewerOptionsGroupId, key: string, value: ViewerOptionPrimitive): void {
		this.store.setValue(group, key, value);
	}

	setRibbonTabHidden(tabId: ToolbarTabId, hidden: boolean): void {
		this.store.setRibbonTabHidden(tabId, hidden);
	}

	setQuickAccessCommands(commandIds: readonly string[]): void {
		this.store.setQuickAccessCommands(commandIds);
	}

	reset(group?: ViewerOptionsGroupId): void {
		this.store.reset(group);
	}

	/** Restore a snapshot wholesale (the dialog's Cancel semantics). */
	restore(snapshot: ViewerOptions): void {
		this.store.setOptions(snapshot);
	}

	// ── Behavior resolution helpers ─────────────────────────────────────────

	/** Undo-stack depth for `new EditorHistory({ maxDepth })`. */
	historyDepth(): number {
		return resolveHistoryDepth(this.options());
	}

	/** AutoRecover cadence in seconds for the autosave engine. */
	autosaveIntervalSeconds(): number {
		return resolveAutosaveIntervalSeconds(this.options());
	}

	/** Print-dialog seed; `undefined` keeps the dialog's own recents. */
	printDefaults(): Partial<PrintSettings> | undefined {
		return resolveDefaultPrintSettings(this.options());
	}

	/** Option-driven CSS classes for the viewer root (`pptx-ng-*` prefixed). */
	rootClasses(): string[] {
		return resolveOptionRootClasses(this.options(), 'pptx-ng');
	}

	/** Tooltip text under the current ScreenTip style (undefined = suppress). */
	screenTip(label: string, description?: string, shortcut?: string): string | undefined {
		return resolveScreenTip(this.options(), label, description, shortcut);
	}

	/** Run the enabled AutoCorrect rules over a committed run of text. */
	autoCorrect(text: string): string {
		return applyAutoCorrect(text, this.options().proofing);
	}

	/** Play the Accessibility "feedback with sound" cue for a completed action. */
	playFeedback(): void {
		playFeedbackSound(this.options());
	}

	/** Whether Trust Center forces the deck to open read-only. */
	protectedView(): boolean {
		return shouldOpenInProtectedView(this.options());
	}

	/**
	 * Gate an external hyperlink activation. Returns `true` when navigation may
	 * proceed (no confirmation required, or the user confirmed the prompt).
	 */
	confirmExternalHyperlink(href: string): boolean {
		if (!shouldConfirmExternalHyperlink(this.options(), href)) {
			return true;
		}
		if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
			return true;
		}
		const label =
			this.translate?.instant('pptx.options.trust.confirmHyperlinks') ??
			'Confirm before opening external hyperlinks';
		return window.confirm(`${label}\n\n${href}`);
	}

	/**
	 * Options > Save > "Delete cached files": purge every autosave recovery
	 * snapshot from the shared IndexedDB store. Resolves with the purge count.
	 */
	async clearCache(): Promise<number> {
		const snapshots = await listAutosaveSnapshots();
		await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
		return snapshots.length;
	}
}
