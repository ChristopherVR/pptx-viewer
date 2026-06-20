/**
 * `useRehearseTimings`: Vue composable for rehearsal-mode timing.
 *
 * Tracks the elapsed time on the current slide and the total elapsed time since
 * the presentation started, with pause/resume support and per-slide recording.
 * Mirrors the React `useRehearsalTimings` hook plus the live-ticking display
 * math of `RehearseTimingsHud`.
 *
 * The pure timer math (`computeElapsed`, `formatRehearseMs`) is exported
 * separately so it can be unit-tested without timers, and the composable owns
 * a 250 ms tick (paused while `paused` is true) so the HUD updates live.
 *
 * @module composables/useRehearseTimings
 */

import { computed, onScopeDispose, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';

// ---------------------------------------------------------------------------
// Pure helpers (DOM/timer-free, unit-testable)
// ---------------------------------------------------------------------------

/**
 * Format a millisecond duration as `M:SS` (minutes are not zero-padded, seconds
 * are). Matches the React `RehearseTimingsHud`/`RehearseTimingsSummary`
 * `formatMs` helper.
 */
export function formatRehearseMs(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Compute the elapsed time (ms) between a start timestamp and `now`, subtracting
 * any accumulated paused time and the open pause segment. Returns 0 when not
 * started. Never negative.
 *
 * @param startTime - Timestamp (ms) the timer started, or `null` if not started.
 * @param now - The reference "now" timestamp (ms).
 * @param pausedAccumulatedMs - Already-accumulated paused time (ms).
 * @param pauseStart - Timestamp (ms) the current pause began, or `null`.
 */
export function computeElapsed(
	startTime: number | null,
	now: number,
	pausedAccumulatedMs = 0,
	pauseStart: number | null = null,
): number {
	if (startTime === null) {
		return 0;
	}
	let paused = pausedAccumulatedMs;
	if (pauseStart !== null) {
		paused += now - pauseStart;
	}
	return Math.max(0, now - startTime - paused);
}

// ---------------------------------------------------------------------------
// Options / Result
// ---------------------------------------------------------------------------

export interface UseRehearseTimingsOptions {
	/** Called with the recorded per-slide timings (ms) when the user saves. */
	onSave?: (timings: Record<number, number>) => void;
	/** How often (ms) to tick the live display. Defaults to 250. */
	tickIntervalMs?: number;
	/** Injectable clock for testing. Defaults to `Date.now`. */
	now?: () => number;
}

export interface UseRehearseTimingsResult {
	/** Whether a rehearsal session is in progress. */
	rehearsing: Ref<boolean>;
	/** Whether the rehearsal timer is paused. */
	paused: Ref<boolean>;
	/** Whether the post-rehearsal summary should be shown. */
	showSummary: Ref<boolean>;
	/** Recorded per-slide timings (slide index → ms). */
	recordedTimings: Ref<Record<number, number>>;
	/** Live elapsed time (ms) on the current slide. */
	slideElapsedMs: ComputedRef<number>;
	/** Live total elapsed time (ms) since the presentation started. */
	totalElapsedMs: ComputedRef<number>;
	/** Sum (ms) of all recorded slide timings. */
	totalRecordedMs: ComputedRef<number>;
	/** Begin a rehearsal session, resetting all timing state. */
	start: () => void;
	/**
	 * Record the time spent on `slideIndex` and reset the per-slide timer for the
	 * next slide. No-op if the slide timer hasn't started.
	 */
	recordCurrentSlideTime: (slideIndex: number) => void;
	/** Toggle the paused state, accumulating paused time on resume. */
	togglePause: () => void;
	/** Persist the recorded timings (via `onSave`) and end the session. */
	saveTimings: () => void;
	/** Discard the recorded timings and end the session. */
	dismissSummary: () => void;
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useRehearseTimings(
	options: UseRehearseTimingsOptions = {},
): UseRehearseTimingsResult {
	const now = options.now ?? Date.now;
	const tickIntervalMs = options.tickIntervalMs ?? 250;

	const rehearsing = ref(false);
	const paused = ref(false);
	const showSummary = ref(false);
	const recordedTimings = ref<Record<number, number>>({});

	const presentationStartTime = ref<number | null>(null);
	const slideStartTime = ref<number | null>(null);

	// Mutable, non-reactive pause bookkeeping.
	let pauseAccumulated = 0;
	let pauseStart: number | null = null;

	// `tick` drives the live elapsed computeds: bumping it re-derives them.
	const tick = ref(0);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	function stopTicking(): void {
		if (intervalId !== null) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	function startTicking(): void {
		stopTicking();
		if (typeof setInterval !== 'function') {
			return;
		}
		intervalId = setInterval(() => {
			tick.value += 1;
		}, tickIntervalMs);
	}

	const slideElapsedMs = computed<number>(() => {
		void tick.value;
		if (!rehearsing.value) {
			return 0;
		}
		return computeElapsed(slideStartTime.value, now(), pauseAccumulated, pauseStart);
	});

	const totalElapsedMs = computed<number>(() => {
		void tick.value;
		if (!rehearsing.value) {
			return 0;
		}
		return computeElapsed(presentationStartTime.value, now());
	});

	const totalRecordedMs = computed<number>(() =>
		Object.values(recordedTimings.value).reduce((sum, ms) => sum + ms, 0),
	);

	function start(): void {
		const t = now();
		rehearsing.value = true;
		paused.value = false;
		showSummary.value = false;
		recordedTimings.value = {};
		pauseAccumulated = 0;
		pauseStart = null;
		presentationStartTime.value = t;
		slideStartTime.value = t;
		startTicking();
	}

	function recordCurrentSlideTime(slideIndex: number): void {
		if (slideStartTime.value === null) {
			return;
		}
		const elapsed = computeElapsed(slideStartTime.value, now(), pauseAccumulated, pauseStart);
		recordedTimings.value = {
			...recordedTimings.value,
			[slideIndex]: elapsed,
		};
		// Reset the per-slide timer (carry the open-pause segment forward).
		pauseAccumulated = 0;
		pauseStart = paused.value ? now() : null;
		slideStartTime.value = now();
	}

	function togglePause(): void {
		// The pause bookkeeping is non-reactive; bump the tick so the live
		// elapsed computeds re-evaluate immediately after the toggle.
		tick.value += 1;
		if (paused.value) {
			// Resuming: fold the open pause segment into the accumulator.
			if (pauseStart !== null) {
				pauseAccumulated += now() - pauseStart;
				pauseStart = null;
			}
			paused.value = false;
			startTicking();
		} else {
			pauseStart = now();
			paused.value = true;
			stopTicking();
		}
	}

	function saveTimings(): void {
		options.onSave?.(recordedTimings.value);
		showSummary.value = false;
		rehearsing.value = false;
		stopTicking();
	}

	function dismissSummary(): void {
		showSummary.value = false;
		rehearsing.value = false;
		recordedTimings.value = {};
		stopTicking();
	}

	onScopeDispose(stopTicking);

	return {
		rehearsing,
		paused,
		showSummary,
		recordedTimings,
		slideElapsedMs,
		totalElapsedMs,
		totalRecordedMs,
		start,
		recordCurrentSlideTime,
		togglePause,
		saveTimings,
		dismissSummary,
	};
}
