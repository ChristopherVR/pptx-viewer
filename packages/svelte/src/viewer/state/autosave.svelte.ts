import type {
	PptxHandoutMaster,
	PptxHandler,
	PptxNotesMaster,
	PptxSection,
	PptxSlide,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import type { DeckSaveIntent } from 'pptx-viewer-shared';
import {
	recoverySnapshotIntent,
	saveAutosaveSnapshot,
	saveDeckWithPassword,
} from 'pptx-viewer-shared';

/**
 * autosave.svelte.ts: debounced crash-recovery autosave for the Svelte viewer.
 *
 * A runes port that fuses the two shared semantics the other bindings use:
 *  - React's persistence target: each successful save writes the serialized
 *    `.pptx` bytes to the shared IndexedDB recovery store
 *    (`saveAutosaveSnapshot`, keyed by `filePath`), so a host can offer
 *    restore-on-load with `getAutosaveSnapshot` / `listAutosaveSnapshots`
 *    (both re-exported from this package). This binding does NOT auto-restore;
 *    matching React/Vue, recovery is a host concern.
 *  - Vue's debounce-on-edit trigger: an edit marks the document dirty and
 *    (re)arms a debounce timer instead of polling on a fixed interval.
 *
 * The controller registers its own edit-watching `$effect` in the constructor,
 * so the SFC only has to construct it once during setup and read its reactive
 * `status` / `isDirty` for the toolbar indicator.
 */

/**
 * Autosave status, surfaced for the toolbar status pill.
 *
 *  - `idle`     : nothing has been saved yet (or no edits since mount).
 *  - `disabled` : autosave is inactive (off, not editable, or no file path).
 *  - `saving`   : a save is currently in flight.
 *  - `saved`    : the most recent save succeeded.
 *  - `error`    : the most recent save threw.
 */
export type AutosaveStatus = 'idle' | 'disabled' | 'saving' | 'saved' | 'error';

export interface AutosaveDeps {
	/** Master on/off: host `autosave` prop AND editing allowed. */
	getEnabled: () => boolean;
	/** Debounce window in milliseconds. */
	getIntervalMs: () => number;
	/** IndexedDB record key (host `filePath`); autosave is disabled without one. */
	getFilePath: () => string | undefined;
	/** The current editable slides (watched for edits). */
	getSlides: () => PptxSlide[];
	getSlideMasters?: () => PptxSlideMaster[];
	getNotesMaster?: () => PptxNotesMaster | undefined;
	getHandoutMaster?: () => PptxHandoutMaster | undefined;
	getSections?: () => PptxSection[];
	/** The live core handler used to serialize slides to `.pptx` bytes. */
	getHandler: () => PptxHandler | null;
	/**
	 * The Protect-Presentation state, forwarded to the shared save decision.
	 * Optional, and deliberately inert: a recovery snapshot is written in the
	 * clear whatever it says (see `deck-save-encryption` in
	 * `pptx-viewer-shared`). It is threaded through so the snapshot path uses
	 * the same one decision function as every real save.
	 */
	getSaveIntent?: () => DeckSaveIntent;
	/**
	 * Monotonic load counter: a change means a fresh presentation was seeded (not
	 * a user edit), so the watcher clears dirty instead of arming a save.
	 */
	getLoadCount: () => number;
	/** Host callback with the freshly-serialized bytes on each successful save. */
	onSaved?: (bytes: Uint8Array) => void;
}

export class AutosaveController {
	/** Current autosave lifecycle status (reactive). */
	status = $state<AutosaveStatus>('idle');
	/** Whether there are unsaved edits pending (reactive). */
	isDirty = $state(false);
	/** Epoch ms of the last successful save, or null (reactive). */
	lastSavedAt = $state<number | null>(null);

	readonly #deps: AutosaveDeps;
	#timer: ReturnType<typeof setTimeout> | null = null;
	#saving = false;
	#lastLoadCount = 0;
	#started = false;

	constructor(deps: AutosaveDeps) {
		this.#deps = deps;
		this.#lastLoadCount = deps.getLoadCount();

		// Watch edits: reassigning the (immutable) slide array on each edit fires
		// this effect. A load bumps `getLoadCount()` in the same flush, which we
		// treat as a reseed (clear dirty) rather than an edit. The effect's
		// teardown clears any pending debounce on destroy.
		$effect(() => {
			const loadCount = this.#deps.getLoadCount();
			// Track the slides so edits (array reassignment) re-run the effect.
			this.#deps.getSlides();
			this.#deps.getSlideMasters?.();
			this.#deps.getNotesMaster?.();
			this.#deps.getHandoutMaster?.();
			this.#deps.getSections?.();

			if (!this.#started) {
				this.#started = true;
				this.#lastLoadCount = loadCount;
				return;
			}
			if (loadCount !== this.#lastLoadCount) {
				this.#lastLoadCount = loadCount;
				this.#clearTimer();
				this.isDirty = false;
				return;
			}
			this.isDirty = true;
			if (this.#isEnabled()) {
				this.#schedule();
			}
			return () => this.#clearTimer();
		});
	}

	#isEnabled(): boolean {
		return this.#deps.getEnabled() && Boolean(this.#deps.getFilePath());
	}

	#clearTimer(): void {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}

	#schedule(): void {
		this.#clearTimer();
		this.#timer = setTimeout(() => {
			this.#timer = null;
			if (this.#isEnabled()) {
				void this.save();
			}
		}, this.#deps.getIntervalMs());
	}

	/**
	 * Serialize the current slides to `.pptx` bytes, or null when unavailable.
	 *
	 * Routed through the shared `saveDeckWithPassword` with an explicit
	 * `recoverySnapshotIntent` rather than calling `handler.save` directly. The
	 * bytes are identical (a recovery snapshot is always a plain ZIP), but the
	 * decision is now the same one every binding makes, so this cannot drift
	 * into writing an encrypted snapshot that recovery could never reopen.
	 */
	async #serialize(): Promise<Uint8Array | null> {
		const handler = this.#deps.getHandler();
		if (!handler) {
			return null;
		}
		const slideMasters = this.#deps.getSlideMasters?.();
		const notesMaster = this.#deps.getNotesMaster?.();
		const handoutMaster = this.#deps.getHandoutMaster?.();
		const sections = this.#deps.getSections?.();
		const hasMasters = Boolean(slideMasters?.length || notesMaster || handoutMaster);
		return saveDeckWithPassword(
			handler,
			this.#deps.getSlides(),
			hasMasters
				? {
						slideMasters,
						notesMaster,
						handoutMaster,
						sections: sections?.length ? sections : undefined,
					}
				: { sections: sections?.length ? sections : undefined },
			recoverySnapshotIntent(this.#deps.getSaveIntent?.()),
		);
	}

	/** Force an immediate save, bypassing the debounce window. */
	async save(): Promise<void> {
		const filePath = this.#deps.getFilePath();
		if (!filePath || this.#saving) {
			return;
		}
		this.#saving = true;
		this.#clearTimer();
		this.status = 'saving';
		try {
			const bytes = await this.#serialize();
			if (!bytes) {
				this.status = 'idle';
				return;
			}
			await saveAutosaveSnapshot(filePath, bytes);
			this.lastSavedAt = Date.now();
			this.isDirty = false;
			this.status = 'saved';
			this.#deps.onSaved?.(bytes);
		} catch {
			this.status = 'error';
		} finally {
			this.#saving = false;
		}
	}
}
