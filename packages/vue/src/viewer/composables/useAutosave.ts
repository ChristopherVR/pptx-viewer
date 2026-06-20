import type { PptxSlide } from 'pptx-viewer-core';
import { onScopeDispose, ref, toValue, watch } from 'vue';
import type { Ref } from 'vue';

/**
 * Autosave status, surfaced for status-pill rendering.
 *
 *  - `idle`  : nothing has been saved yet (or no edits since mount).
 *  - `saving`: an `onSave` invocation is currently in flight.
 *  - `saved` : the most recent save succeeded.
 *  - `error` : the most recent save threw.
 */
export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Timer-injection seam so the debounce window is testable with
 * `vi.useFakeTimers()`. Defaults to the global `setTimeout` /
 * `clearTimeout`; tests can leave them unset (fake timers patch the
 * globals) or override explicitly.
 */
export interface AutosaveTimerApi {
	setTimer: (handler: () => void, timeoutMs: number) => number;
	clearTimer: (id: number) => void;
}

export interface UseAutosaveOptions {
	/**
	 * The editor's reactive slide array. Because the editor reassigns this
	 * array immutably on every edit, a shallow `watch(slides, …)` fires per
	 * edit, no `deep` needed.
	 */
	slides: Ref<PptxSlide[]>;
	/** Master on/off switch. When falsy the debounce timer never fires. */
	enabled?: Ref<boolean> | boolean;
	/** Debounce window in milliseconds (e.g. `2000`). */
	intervalMs: number;
	/**
	 * Host save callback: typically calls `getContent()` and persists/emits
	 * the resulting bytes. May be sync or async; rejections flip status to
	 * `'error'`.
	 */
	onSave: () => void | Promise<void>;
	/** Injectable timer API for testing. Defaults to the global timers. */
	timers?: AutosaveTimerApi;
}

export interface UseAutosaveResult {
	/** Current autosave lifecycle status. */
	status: Ref<AutosaveStatus>;
	/** Epoch ms of the last successful save, or `null`. */
	lastSavedAt: Ref<number | null>;
	/** Force an immediate save, bypassing the debounce window. */
	saveNow: () => Promise<void>;
	/** True when there are unsaved edits pending. */
	isDirty: Ref<boolean>;
}

const defaultTimers: AutosaveTimerApi = {
	setTimer: (handler, timeoutMs) => setTimeout(handler, timeoutMs) as unknown as number,
	clearTimer: (id) => {
		clearTimeout(id);
	},
};

/**
 * `useAutosave`: debounced autosave for the Vue editor.
 *
 * Watches `slides`; on each change it marks the document dirty and
 * (re)arms a debounce timer. When the timer fires (and autosave is
 * enabled) it runs `onSave()`, transitioning `status`
 * `saving → saved | error`, stamping `lastSavedAt`, and clearing the
 * dirty flag. `saveNow()` performs the same save synchronously, cancelling
 * any pending debounce. The timer is torn down on scope dispose.
 */
export function useAutosave(options: UseAutosaveOptions): UseAutosaveResult {
	const { slides, enabled = true, intervalMs, onSave } = options;
	const timers = options.timers ?? defaultTimers;

	const status = ref<AutosaveStatus>('idle');
	const lastSavedAt = ref<number | null>(null);
	const isDirty = ref(false);

	let timerId: number | null = null;
	let savePromise: Promise<void> | null = null;

	const isEnabled = (): boolean => toValue(enabled) !== false;

	const clearTimer = (): void => {
		if (timerId !== null) {
			timers.clearTimer(timerId);
			timerId = null;
		}
	};

	const runSave = async (): Promise<void> => {
		// Serialise overlapping saves: chain onto any in-flight save.
		if (savePromise) {
			await savePromise.catch(() => {});
		}
		clearTimer();
		status.value = 'saving';
		const pending = (async () => {
			try {
				await onSave();
				lastSavedAt.value = Date.now();
				isDirty.value = false;
				status.value = 'saved';
			} catch (err) {
				status.value = 'error';
				throw err;
			}
		})();
		savePromise = pending.then(
			() => undefined,
			() => undefined,
		);
		try {
			await pending;
		} finally {
			savePromise = null;
		}
	};

	const saveNow = (): Promise<void> => runSave();

	const scheduleSave = (): void => {
		clearTimer();
		timerId = timers.setTimer(() => {
			timerId = null;
			if (isEnabled()) {
				void runSave().catch(() => {});
			}
		}, intervalMs);
	};

	// Fires only on actual reassignments of `slides` (not on setup, since
	// `immediate` is omitted), so each edit marks the document dirty and
	// arms the debounce. The host is responsible for not re-priming `slides`
	// with the freshly-loaded document in a way that should trigger a save.
	watch(
		slides,
		() => {
			isDirty.value = true;
			if (isEnabled()) {
				scheduleSave();
			}
		},
		// Flush synchronously so an edit immediately marks the document dirty
		// and arms the debounce timer, matching the React effect-on-change
		// behaviour and keeping fake-timer tests deterministic.
		{ flush: 'sync' },
	);

	onScopeDispose(() => {
		clearTimer();
	});

	return { status, lastSavedAt, saveNow, isDirty };
}
