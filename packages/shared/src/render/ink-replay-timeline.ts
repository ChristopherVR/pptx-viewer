/**
 * Pure per-stroke replay timing decision, shared by every binding's ink
 * replay trigger point ("watch the ink get drawn" during presentation mode).
 *
 * Mirrors the "build an ordered list of timed steps from parsed data" shape
 * `animation-timeline-builder.ts` uses for slide animation playback: given
 * each stroke's own point timestamps (when the source declared a usable time
 * channel; see `inkml-trace-decode.ts`'s `pointsToTimestamps`, threaded onto
 * `ContentPartInkStroke.pointTimestamps`), or nothing at all when it didn't,
 * this produces one {@link InkReplayStep} per stroke. A binding never
 * computes replay offsets itself; `ink-rendering.ts`'s `getInkReplayStyles`/
 * `getContentPartReplayStyles` call this once and map the returned steps onto
 * CSS animation-delay/duration, so every binding gets real timing for free.
 *
 * @module render/ink-replay-timeline
 */

/** Default per-stroke reveal duration when no real timing data drives it. */
export const DEFAULT_STROKE_DURATION_MS = 600;
/** Default delay between consecutive strokes when no real timing data drives it. */
export const DEFAULT_STROKE_DELAY_MS = 200;
/**
 * Floor on a real-timestamp-derived stroke duration. A near-instantaneous dot
 * (first and last point timestamped only a few ms apart) would otherwise
 * flash faster than a reveal animation can be perceived; this project's own
 * choice, kept small enough to stay imperceptible for any stroke slower than
 * a genuine tap.
 */
export const MIN_REAL_STROKE_DURATION_MS = 60;

/** Configuration for ink replay animation timing. */
export interface InkReplayConfig {
	/** Duration of each stroke's reveal in milliseconds, used when no real timing data exists. Default 600. */
	strokeDurationMs?: number;
	/** Delay between consecutive strokes in milliseconds, used when no real timing data exists. Default 200. */
	strokeDelayMs?: number;
	/** Easing function. Default "ease-in-out". */
	easing?: string;
}

/** One stroke's place in a replay sequence: when its reveal starts, and how long it takes. */
export interface InkReplayStep {
	strokeIndex: number;
	startOffsetMs: number;
	durationMs: number;
}

/** The fixed cascade every stroke used before real timing data existed: stroke `i` starts once stroke `i - 1` finishes plus a gap. */
function fixedCascadeTimeline(
	strokeCount: number,
	duration: number,
	delay: number,
): InkReplayStep[] {
	return Array.from({ length: strokeCount }, (_, strokeIndex) => ({
		strokeIndex,
		startOffsetMs: strokeIndex * (duration + delay),
		durationMs: duration,
	}));
}

/**
 * Build the ordered replay timeline for an ink element's strokes.
 *
 * When EVERY stroke carries at least one real timestamp, each step's offset
 * and duration come from that stroke's own first/last timestamp, normalised
 * so the earliest stroke starts at offset 0: this is real per-stroke timing,
 * not the fixed cascade. A part mixing timed and untimed strokes (this
 * library's own authored dialect has no time channel at all, so a document
 * combining a loaded real trace with a locally drawn one could) has no shared
 * clock to place the untimed strokes on, so the whole element falls back to
 * the fixed cascade rather than collapsing the untimed strokes to a bogus
 * offset of 0.
 */
export function buildInkReplayTimeline(
	strokeTimestamps: ReadonlyArray<readonly number[] | undefined>,
	config: InkReplayConfig = {},
): InkReplayStep[] {
	const duration = config.strokeDurationMs ?? DEFAULT_STROKE_DURATION_MS;
	const delay = config.strokeDelayMs ?? DEFAULT_STROKE_DELAY_MS;

	const hasFullRealTiming =
		strokeTimestamps.length > 0 &&
		strokeTimestamps.every((timestamps) => timestamps !== undefined && timestamps.length > 0);

	if (!hasFullRealTiming) {
		return fixedCascadeTimeline(strokeTimestamps.length, duration, delay);
	}

	const timed = strokeTimestamps as readonly (readonly number[])[];
	const starts = timed.map((timestamps) => Math.min(...timestamps));
	const ends = timed.map((timestamps) => Math.max(...timestamps));
	const t0 = Math.min(...starts);

	return timed.map((_, strokeIndex) => ({
		strokeIndex,
		startOffsetMs: Math.max(0, starts[strokeIndex] - t0),
		durationMs: Math.max(MIN_REAL_STROKE_DURATION_MS, ends[strokeIndex] - starts[strokeIndex]),
	}));
}
