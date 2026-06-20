/**
 * presentation-subtitle-helpers.ts: Pure helpers for the subtitle/caption bar.
 *
 * Isolates all text-segment logic so it can be unit-tested without DOM or
 * Angular dependencies.
 *
 * Ported from React:
 *   packages/react/src/viewer/components/PresentationSubtitleBar.tsx
 */

// ---------------------------------------------------------------------------
// Speech recognition structural types
// ---------------------------------------------------------------------------

/**
 * A single speech recognition alternative (best-guess transcript + confidence).
 * Matches the shape of the Web Speech API `SpeechRecognitionAlternative`.
 */
export interface SpeechAlternative {
	readonly transcript: string;
	readonly confidence: number;
}

/**
 * One result from the recognition engine: array of alternatives plus a
 * `isFinal` flag that indicates whether this result is stable (true) or
 * still being refined (false, i.e. interim).
 */
export interface SpeechResult {
	readonly isFinal: boolean;
	readonly length: number;
	readonly [index: number]: SpeechAlternative;
}

/**
 * The list of all results accumulated in a recognition session.
 */
export interface SpeechResultList {
	readonly length: number;
	readonly [index: number]: SpeechResult;
}

/**
 * Subset of `SpeechRecognitionEvent`: just what we need.
 */
export interface SpeechRecognitionEventLite {
	readonly resultIndex: number;
	readonly results: SpeechResultList;
}

/**
 * Structural interface matching the Web Speech API `SpeechRecognition` object.
 * Kept minimal so we only depend on what we actually use.
 */
export interface SpeechRecognitionLite extends EventTarget {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEventLite) => void) | null;
	onerror: ((event: Event) => void) | null;
	onend: (() => void) | null;
	start: () => void;
	stop: () => void;
}

/** Constructor signature for the speech recognition object. */
export type SpeechRecognitionCtor = new () => SpeechRecognitionLite;

// ---------------------------------------------------------------------------
// Caption text merging
// ---------------------------------------------------------------------------

/**
 * Merge the results from a `SpeechRecognitionEventLite` (starting at
 * `resultIndex`) into a single caption string.
 *
 * Final results form the stable prefix; interim results form the unstable
 * suffix. Both are joined and the combined string is trimmed.
 *
 * @param event        The recognition event from `onresult`.
 * @param resultIndex  `event.resultIndex`: the first new result index.
 * @param results      `event.results`: the full results list.
 * @returns            The merged caption string, or `''` if nothing recognised.
 */
export function mergeCaptionResults(resultIndex: number, results: SpeechResultList): string {
	let finalText = '';
	let interimText = '';
	for (let i = resultIndex; i < results.length; i += 1) {
		const result = results[i];
		const fragment = result?.[0]?.transcript ?? '';
		if (result?.isFinal) {
			finalText += fragment;
		} else {
			interimText += fragment;
		}
	}
	const merged = `${finalText} ${interimText}`.trim();
	return merged;
}

// ---------------------------------------------------------------------------
// Safe speech recognition factory
// ---------------------------------------------------------------------------

/**
 * Attempt to obtain the `SpeechRecognition` constructor from `globalThis`
 * (browser `window`). Returns `null` when unavailable (SSR / unsupported
 * browsers / Firefox without the flag enabled).
 *
 * Checks both the standard and the webkit-prefixed name.
 */
export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
	// Use `globalThis` rather than `window` so this runs in non-DOM environments.
	const g = globalThis as Record<string, unknown>;
	const ctor = (g['SpeechRecognition'] ?? g['webkitSpeechRecognition']) as
		| SpeechRecognitionCtor
		| undefined;
	return ctor ?? null;
}

// ---------------------------------------------------------------------------
// Caption display text helper
// ---------------------------------------------------------------------------

/** Possible support states for the Web Speech API in this environment. */
export type SpeechSupportState = 'unknown' | 'supported' | 'unsupported';

/**
 * Compute the text to display in the caption bar.
 *
 * - When the API is unsupported, returns `fallbackNotSupported`.
 * - When supported but no text has been captured yet, returns `fallbackListening`.
 * - Otherwise returns the captured text.
 */
export function captionDisplayText(
	supportState: SpeechSupportState,
	captionText: string,
	fallbackNotSupported: string,
	fallbackListening: string,
): string {
	if (supportState === 'unsupported') {
		return fallbackNotSupported;
	}
	return captionText.length > 0 ? captionText : fallbackListening;
}
