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
	nextAutosaveDelayMs,
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
 * The debounce is CAPPED by the shared `nextAutosaveDelayMs`, so it keeps the
 * same promise React's and Angular's polling engines do: a snapshot lands no
 * later than one interval after the FIRST unsaved edit, and no more often than
 * once per interval. Without that cap a user who keeps typing keeps re-arming
 * the timer, and at the two-minute AutoRecover cadence that is a whole session
 * of work that never reaches the recovery store.
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
	/**
	 * Master on/off: the resolved activation (`resolveAutosaveActivation` in
	 * shared), which folds the host policy, the user's toggle, editability and
	 * the collaboration read-only veto into one answer.
	 */
	getEnabled: () => boolean;
	/** Debounce window in milliseconds, and the ceiling on deferring a save. */
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
	/**
	 * Monotonic SEED counter, bumped in the same synchronous block that installs
	 * the loaded slides (`EditorState.seedNonce`).
	 *
	 * `getLoadCount` alone is not enough, because the loader bumps it in an
	 * earlier flush than the effect that copies its slides into the editor: this
	 * watcher ran once on the count change (old slides, so nothing to do) and
	 * then a second time on the slide reassignment, with the count already
	 * settled - indistinguishable from an edit. Merely OPENING a deck therefore
	 * marked it dirty and wrote a crash-recovery snapshot, so the next visit
	 * offered to recover unsaved changes that never existed.
	 */
	getSeedNonce?: () => number;
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
	#lastSeedNonce = 0;
	#started = false;
	/**
	 * Epoch ms of the OLDEST edit not yet in a snapshot, or null when the
	 * document is clean. This, not the latest edit, is what the debounce is
	 * measured against.
	 */
	#firstDirtyAt: number | null = null;

	constructor(deps: AutosaveDeps) {
		this.#deps = deps;
		this.#lastLoadCount = deps.getLoadCount();
		this.#lastSeedNonce = deps.getSeedNonce?.() ?? 0;

		// Watch edits: reassigning the (immutable) slide array on each edit fires
		// this effect. A load bumps `getLoadCount()` in the same flush, which we
		// treat as a reseed (clear dirty) rather than an edit. The effect's
		// teardown clears any pending debounce on destroy.
		$effect(() => {
			const loadCount = this.#deps.getLoadCount();
			const seedNonce = this.#deps.getSeedNonce?.() ?? 0;
			// Track the slides so edits (array reassignment) re-run the effect.
			this.#deps.getSlides();
			this.#deps.getSlideMasters?.();
			this.#deps.getNotesMaster?.();
			this.#deps.getHandoutMaster?.();
			this.#deps.getSections?.();

			if (!this.#started) {
				this.#started = true;
				this.#lastLoadCount = loadCount;
				this.#lastSeedNonce = seedNonce;
				return;
			}
			// Either half of a load counts as a reseed. They arrive in separate
			// flushes (see `getSeedNonce`), so both have to be able to answer.
			if (loadCount !== this.#lastLoadCount || seedNonce !== this.#lastSeedNonce) {
				this.#lastLoadCount = loadCount;
				this.#lastSeedNonce = seedNonce;
				this.#clearTimer();
				this.#firstDirtyAt = null;
				this.isDirty = false;
				return;
			}
			this.isDirty = true;
			this.#firstDirtyAt ??= Date.now();
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

	/**
	 * (Re)arm the debounce. The delay is whatever is LEFT of the first unsaved
	 * edit's interval, so an unbroken stream of edits still gets a snapshot each
	 * interval instead of pushing the deadline out forever.
	 */
	#schedule(): void {
		this.#clearTimer();
		const delay = nextAutosaveDelayMs({
			intervalMs: this.#deps.getIntervalMs(),
			firstDirtyAt: this.#firstDirtyAt,
			now: Date.now(),
		});
		this.#timer = setTimeout(() => {
			this.#timer = null;
			if (this.#isEnabled()) {
				void this.save();
			}
		}, delay);
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
		// Remembered across the await: an edit that lands mid-save starts a NEW
		// dirty window, and clearing it below would hide that edit from the
		// interval ceiling until the user happened to type again.
		const savingFrom = this.#firstDirtyAt;
		this.status = 'saving';
		try {
			const bytes = await this.#serialize();
			if (!bytes) {
				this.status = 'idle';
				return;
			}
			await saveAutosaveSnapshot(filePath, bytes);
			this.lastSavedAt = Date.now();
			if (this.#firstDirtyAt === savingFrom) {
				this.#firstDirtyAt = null;
				this.isDirty = false;
			}
			this.status = 'saved';
			this.#deps.onSaved?.(bytes);
		} catch {
			this.status = 'error';
		} finally {
			this.#saving = false;
		}
	}
}
