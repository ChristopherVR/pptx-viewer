import { cloneSlide } from 'pptx-viewer-core';
import type { PptxSlide } from 'pptx-viewer-core';
import { computed, shallowRef } from 'vue';
import type { ComputedRef, Ref } from 'vue';

/**
 * useVersionHistory — named, restorable snapshots of the live slide model.
 *
 * Vue port of the React version-history subsystem. Where the React
 * `VersionHistoryPanel` reads serialised `.pptx` blobs out of the autosave
 * IndexedDB store, this composable keeps an in-memory list of **deep-cloned
 * slide snapshots** (via the core `cloneSlide` helper), each tagged with a
 * caller-supplied label and timestamp.
 *
 * Design notes:
 *  - **Pure capture path.** `capture` does *not* call `Date.now()` — the caller
 *    passes a `label` and `now` (epoch ms). This keeps snapshot creation
 *    deterministic and unit-testable; the UI layer supplies `Date.now()`.
 *  - **History-aware restore.** `restore` snapshots the current live state onto
 *    the editor undo stack (via the injected `pushHistory`) *before* replacing
 *    `slides.value`, so a restore is a single undoable step.
 *  - **Bounded list.** The snapshot list is capped (oldest dropped first) to
 *    bound memory for long editing sessions.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default cap on retained snapshots (oldest dropped first when exceeded). */
export const DEFAULT_MAX_VERSIONS = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single captured version: a deep-cloned slide array + metadata. */
export interface SlideVersion {
	/** Stable, collision-resistant identifier. */
	id: string;
	/** Human-readable label supplied at capture time. */
	label: string;
	/** Capture time in epoch milliseconds, supplied by the caller. */
	timestamp: number;
	/** Number of slides in the snapshot (cheap summary for the UI). */
	slideCount: number;
	/** The deep-cloned slide snapshot. */
	slides: PptxSlide[];
}

export interface UseVersionHistoryOptions {
	/** The live editor slide list (typically a `shallowRef<PptxSlide[]>`). */
	slides: Ref<PptxSlide[]>;
	/**
	 * Snapshot the current live state onto the editor undo stack before a
	 * restore reassigns `slides.value`, so a restore is one undoable step.
	 */
	pushHistory: () => void;
	/** Maximum number of retained versions. Defaults to {@link DEFAULT_MAX_VERSIONS}. */
	maxVersions?: number;
}

export interface UseVersionHistoryResult {
	/** Reactive, newest-last list of captured versions. */
	versions: Ref<SlideVersion[]>;
	/** True when at least one version has been captured. */
	hasVersions: ComputedRef<boolean>;
	/**
	 * Capture the current `slides.value` as a new named version.
	 *
	 * @param label A human-readable label (e.g. "Before edit", a filename).
	 * @param now   Capture timestamp in epoch ms (caller supplies `Date.now()`).
	 * @returns The created {@link SlideVersion}.
	 */
	capture: (label: string, now: number) => SlideVersion;
	/**
	 * Restore the version with the given id into the live slide ref. Snapshots
	 * the current state onto the undo stack first (history-aware). No-op when the
	 * id is unknown. Returns `true` when a restore occurred.
	 */
	restore: (id: string) => boolean;
	/** Remove the version with the given id. Returns `true` when one was removed. */
	remove: (id: string) => boolean;
	/** Drop every captured version. */
	clear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let versionSeq = 0;

/** Generate a collision-resistant version id. */
function makeVersionId(now: number): string {
	versionSeq += 1;
	return `ver-${now}-${versionSeq}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Deep-clone a slide array via the core per-slide cloner. */
function snapshot(source: PptxSlide[]): PptxSlide[] {
	return source.map(cloneSlide);
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useVersionHistory(options: UseVersionHistoryOptions): UseVersionHistoryResult {
	const { slides, pushHistory } = options;
	const maxVersions = Math.max(1, options.maxVersions ?? DEFAULT_MAX_VERSIONS);

	// `shallowRef` is sufficient — the list is always replaced wholesale, never
	// mutated in place, and each snapshot is an opaque cloned array.
	const versions = shallowRef<SlideVersion[]>([]);

	const hasVersions = computed(() => versions.value.length > 0);

	const capture = (label: string, now: number): SlideVersion => {
		const cloned = snapshot(slides.value);
		const version: SlideVersion = {
			id: makeVersionId(now),
			label,
			timestamp: now,
			slideCount: cloned.length,
			slides: cloned,
		};
		const next = [...versions.value, version];
		// Bound the list from the front (drop oldest) when it overflows.
		while (next.length > maxVersions) {
			next.shift();
		}
		versions.value = next;
		return version;
	};

	const restore = (id: string): boolean => {
		const version = versions.value.find((v) => v.id === id);
		if (!version) {
			return false;
		}
		// History-aware: push the current live state so restore is undoable.
		pushHistory();
		// Clone again so the live ref never shares references with the stored
		// snapshot — a subsequent edit must not corrupt the retained version.
		slides.value = snapshot(version.slides);
		return true;
	};

	const remove = (id: string): boolean => {
		const next = versions.value.filter((v) => v.id !== id);
		if (next.length === versions.value.length) {
			return false;
		}
		versions.value = next;
		return true;
	};

	const clear = (): void => {
		versions.value = [];
	};

	return {
		versions,
		hasVersions,
		capture,
		restore,
		remove,
		clear,
	};
}
