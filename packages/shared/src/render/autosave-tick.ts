/**
 * @fileoverview Should this autosave tick actually write a recovery snapshot?
 *
 * ## The divergence this closes
 *
 * Five bindings, two engine shapes. Vue, Svelte and Vanilla DEBOUNCE: an edit
 * reassigns the slides array, that arms a timer, the timer writes once. React
 * and Angular POLL: a `setInterval` fires every N seconds and writes whenever
 * the document is dirty. The document stays dirty until the user performs a
 * real save, so the polling pair re-serialized the whole deck and rewrote an
 * identical IndexedDB record every tick, for as long as the tab stayed open.
 *
 * This module gives the polling engines the debounce engines' trigger without
 * giving up the fixed cadence: the tick still fires, but it only does work when
 * something the snapshot captures has been reassigned since the last snapshot.
 *
 * ## Why identity, and why it is safe
 *
 * The bindings rebuild editable state immutably, which is exactly what the
 * debounce engines already rely on: Vanilla arms on
 * `state.slides !== previous.slides` and Vue watches `[slides,
 * templateElements]`. Comparing the same references here therefore adds no new
 * blind spot, it only brings React and Angular onto the trigger the other three
 * have always used.
 *
 * Every ambiguous case resolves to WRITING. No previous mark, a different file,
 * a different number of sources, a source that is not a stable reference: all
 * of them write. A redundant snapshot costs a few milliseconds; a suppressed
 * one costs the user their crash recovery, so the asymmetry is deliberate and
 * must stay that way.
 *
 * An explicit `triggerAutosave()` is never gated. It is a request, not a poll.
 *
 * @module render/autosave-tick
 */

/** What the last written snapshot captured. */
export interface AutosaveSnapshotMark {
	/** IndexedDB key the snapshot was written under. */
	readonly filePath: string;
	/** Identities of the editable state that produced it. */
	readonly sources: readonly unknown[];
}

export interface AutosaveTickInput {
	/** IndexedDB key for the recovery snapshot. Autosave is inert without one. */
	readonly filePath: string | undefined;
	/** Whether the document has unsaved edits. */
	readonly isDirty: boolean;
	/** Whether a snapshot write is already in flight. */
	readonly saving: boolean;
	/**
	 * The values a snapshot is built from, read fresh on this tick: the slides
	 * array, the template-element map, and anything else the binding's
	 * serializer reads that is reassigned rather than mutated. Pass an empty
	 * array to opt out of redundancy suppression entirely.
	 */
	readonly sources: readonly unknown[];
	/** The mark left by the last snapshot this engine wrote, if any. */
	readonly lastSnapshot: AutosaveSnapshotMark | undefined;
}

/** Capture the state a just-written snapshot represents. */
export function autosaveSnapshotMark(
	filePath: string,
	sources: readonly unknown[],
): AutosaveSnapshotMark {
	return { filePath, sources: [...sources] };
}

/**
 * True when this tick has real work to do.
 *
 * Read it as the four questions the engines used to ask inline, plus the one
 * they never asked: "has anything changed since the snapshot I already wrote?"
 */
export function shouldWriteAutosaveSnapshot(input: AutosaveTickInput): boolean {
	if (!input.filePath || !input.isDirty || input.saving) {
		return false;
	}
	const previous = input.lastSnapshot;
	if (!previous || previous.filePath !== input.filePath) {
		return true;
	}
	// An engine that supplies nothing to compare gets the old behaviour: write
	// on every tick. Better a wasted write than a lost recovery snapshot.
	if (input.sources.length === 0 || previous.sources.length !== input.sources.length) {
		return true;
	}
	return input.sources.some((source, index) => !Object.is(source, previous.sources[index]));
}
