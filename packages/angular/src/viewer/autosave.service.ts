/**
 * autosave.service.ts: periodic recovery-snapshot autosave for the Angular
 * editor, the counterpart of React's `useAutosave` hook.
 *
 * Every N seconds (default {@link AUTOSAVE_DEFAULT_INTERVAL_SECONDS}, clamped by
 * the shared {@link autosaveIntervalMs}) it serialises the edited deck and writes
 * it to the shared IndexedDB recovery store via {@link saveAutosaveSnapshot} when
 * the document is dirty, a `filePath` key is set, autosave is enabled, and no
 * save is already in flight. The IndexedDB store itself lives in
 * `pptx-viewer-shared` so React/Vue/Angular share one recovery database.
 *
 * Provide it once on the viewer component (`providers: [AutosaveService]`). The
 * component wires its reactive accessors via {@link bind}; the resulting
 * {@link status} signal feeds both the title bar and the status bar.
 */

import { DestroyRef, effect, inject, Injectable, Injector, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import {
	AUTOSAVE_DEFAULT_INTERVAL_SECONDS,
	autosaveIntervalMs,
	saveAutosaveSnapshot,
} from '../internal/shared';

/** Lifecycle status of the autosave engine (mirrors React's `AutosaveStatus`). */
export type AutosaveStatus =
	| { state: 'idle' }
	| { state: 'disabled'; reason: string }
	| { state: 'saving' }
	| { state: 'saved'; timestamp: number }
	| { state: 'error'; message: string };

/** Live host accessors the autosave engine reads (all reactive). */
export interface AutosaveHost {
	/** Whether autosave is enabled (the title-bar AutoSave toggle). */
	readonly enabled: () => boolean;
	/** File path/name keying the recovery snapshot. Autosave is inert when unset. */
	readonly filePath: () => string | undefined;
	/** Whether the deck has unsaved edits. */
	readonly isDirty: () => boolean;
	/** Serialise the current edited deck to `.pptx` bytes (null skips the write). */
	readonly serialize: () => Promise<Uint8Array | null>;
	/** Autosave interval in seconds (defaults to {@link AUTOSAVE_DEFAULT_INTERVAL_SECONDS}). */
	readonly intervalSeconds?: () => number;
}

@Injectable()
export class AutosaveService {
	private readonly injector = inject(Injector);
	private readonly destroyRef = inject(DestroyRef);
	private readonly translate = inject(TranslateService);

	/** Current autosave status, surfaced in the title bar and status bar. */
	readonly status = signal<AutosaveStatus>({ state: 'idle' });

	private host: AutosaveHost | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private saving = false;

	/**
	 * Wire the host accessors (called once from the component constructor). An
	 * effect re-establishes the interval whenever `enabled`, `filePath`, or the
	 * interval length changes, matching React's interval-effect dependencies.
	 */
	bind(host: AutosaveHost): void {
		this.host = host;
		this.destroyRef.onDestroy(() => this.clearTimer());
		effect(
			() => {
				const enabled = host.enabled();
				const filePath = host.filePath();
				const seconds = host.intervalSeconds?.() ?? AUTOSAVE_DEFAULT_INTERVAL_SECONDS;
				this.clearTimer();
				if (!enabled) {
					this.status.set({ state: 'disabled', reason: 'autosave_toggle_off' });
					return;
				}
				if (!filePath) {
					this.status.set({ state: 'disabled', reason: 'no_file_path' });
					return;
				}
				// Requirements met; reset to idle if currently disabled.
				if (this.status().state === 'disabled') {
					this.status.set({ state: 'idle' });
				}
				this.timer = setInterval(() => {
					void this.doAutosave();
				}, autosaveIntervalMs(seconds));
			},
			{ injector: this.injector },
		);
	}

	/** Manually trigger an autosave right now (mirrors React's `triggerAutosave`). */
	async triggerAutosave(): Promise<void> {
		await this.doAutosave();
	}

	private async doAutosave(): Promise<void> {
		const host = this.host;
		if (!host) {
			return;
		}
		const filePath = host.filePath();
		if (!filePath || !host.isDirty() || this.saving) {
			return;
		}

		this.saving = true;
		this.status.set({ state: 'saving' });
		try {
			const data = await host.serialize();
			if (!data) {
				this.status.set({ state: 'idle' });
				return;
			}
			await saveAutosaveSnapshot(filePath, data);
			this.status.set({ state: 'saved', timestamp: Date.now() });
		} catch (err) {
			this.status.set({
				state: 'error',
				message: err instanceof Error ? err.message : this.translate.instant('pptx.autosave.error'),
			});
		} finally {
			this.saving = false;
		}
	}

	private clearTimer(): void {
		if (this.timer !== null) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}
