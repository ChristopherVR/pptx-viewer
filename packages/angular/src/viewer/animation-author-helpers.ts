/**
 * animation-author-helpers.ts — Pure (no Angular) helpers for the animation
 * authoring panel.
 *
 * Ported from / models the authoring semantics of:
 *   packages/react/src/viewer/components/inspector/useAnimationHandlers.ts
 *   packages/react/src/viewer/components/inspector/animation-panel-constants.ts
 *
 * All functions are immutable: they return a new `PptxElementAnimation[]`
 * array without mutating the input. They are intentionally framework-free so
 * they can be tested with plain vitest (no TestBed).
 *
 * Animation data lives on the SLIDE (`PptxSlide.animations`), keyed by
 * `elementId`, NOT on the element itself. The authoring panel reads and emits
 * the entire slide-level `animations` array.
 */

import type {
	PptxAnimationDirection,
	PptxAnimationPreset,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElementAnimation,
} from 'pptx-viewer-core';

// ==========================================================================
// Option catalogs
// ==========================================================================

/** Subset of entrance presets surfaced in the authoring UI. */
export const ENTRANCE_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'appear', label: 'Appear' },
	{ value: 'fadeIn', label: 'Fade In' },
	{ value: 'flyIn', label: 'Fly In' },
	{ value: 'zoomIn', label: 'Zoom In' },
	{ value: 'bounceIn', label: 'Bounce In' },
	{ value: 'wipeIn', label: 'Wipe In' },
	{ value: 'splitIn', label: 'Split In' },
	{ value: 'dissolveIn', label: 'Dissolve In' },
	{ value: 'floatIn', label: 'Float In' },
	{ value: 'growTurnIn', label: 'Grow & Turn' },
];

/** Subset of exit presets surfaced in the authoring UI. */
export const EXIT_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'fadeOut', label: 'Fade Out' },
	{ value: 'flyOut', label: 'Fly Out' },
	{ value: 'zoomOut', label: 'Zoom Out' },
	{ value: 'bounceOut', label: 'Bounce Out' },
	{ value: 'wipeOut', label: 'Wipe Out' },
	{ value: 'shrinkOut', label: 'Shrink Out' },
	{ value: 'dissolveOut', label: 'Dissolve Out' },
	{ value: 'disappear', label: 'Disappear' },
];

/** Subset of emphasis presets surfaced in the authoring UI. */
export const EMPHASIS_PRESETS: ReadonlyArray<{ value: PptxAnimationPreset; label: string }> = [
	{ value: 'spin', label: 'Spin' },
	{ value: 'pulse', label: 'Pulse' },
	{ value: 'colorWave', label: 'Color Wave' },
	{ value: 'bounce', label: 'Bounce' },
	{ value: 'flash', label: 'Flash' },
	{ value: 'growShrink', label: 'Grow / Shrink' },
	{ value: 'teeter', label: 'Teeter' },
	{ value: 'wave', label: 'Wave' },
	{ value: 'boldFlash', label: 'Bold Flash' },
];

/** Trigger options for the trigger selector. */
export const TRIGGER_OPTIONS: ReadonlyArray<{ value: PptxAnimationTrigger; label: string }> = [
	{ value: 'onClick', label: 'On Click' },
	{ value: 'onShapeClick', label: 'On Shape Click' },
	{ value: 'onHover', label: 'On Hover' },
	{ value: 'afterPrevious', label: 'After Previous' },
	{ value: 'withPrevious', label: 'With Previous' },
];

/** Timing curve options. */
export const TIMING_CURVE_OPTIONS: ReadonlyArray<{
	value: PptxAnimationTimingCurve;
	label: string;
}> = [
	{ value: 'ease', label: 'Ease' },
	{ value: 'ease-in', label: 'Ease In' },
	{ value: 'ease-out', label: 'Ease Out' },
	{ value: 'linear', label: 'Linear' },
];

/** Repeat-mode options (`'none'` means clear the field). */
export const REPEAT_MODE_OPTIONS: ReadonlyArray<{
	value: 'none' | PptxAnimationRepeatMode;
	label: string;
}> = [
	{ value: 'none', label: 'Do not repeat' },
	{ value: 'untilNextClick', label: 'Until Next Click' },
	{ value: 'untilEndOfSlide', label: 'Until End of Slide' },
];

/** Direction options for directional presets (fly in/out, wipe). */
export const DIRECTION_OPTIONS: ReadonlyArray<{
	value: PptxAnimationDirection;
	label: string;
	/** Unicode arrow glyph used as an icon substitute in the Angular template. */
	arrow: string;
}> = [
	{ value: 'fromTop', label: 'From Top', arrow: '↓' },
	{ value: 'fromBottom', label: 'From Bottom', arrow: '↑' },
	{ value: 'fromLeft', label: 'From Left', arrow: '→' },
	{ value: 'fromRight', label: 'From Right', arrow: '←' },
	{ value: 'fromTopLeft', label: 'From Top Left', arrow: '↘' },
	{ value: 'fromTopRight', label: 'From Top Right', arrow: '↙' },
	{ value: 'fromBottomLeft', label: 'From Bottom Left', arrow: '↗' },
	{ value: 'fromBottomRight', label: 'From Bottom Right', arrow: '↖' },
];

/** Sequence options for paragraph/word/letter builds. */
export const SEQUENCE_OPTIONS: ReadonlyArray<{ value: PptxAnimationSequence; label: string }> = [
	{ value: 'asOne', label: 'As One Object' },
	{ value: 'byParagraph', label: 'By Paragraph' },
	{ value: 'byWord', label: 'By Word' },
	{ value: 'byLetter', label: 'By Letter' },
];

/** Presets that expose the direction picker. */
export const DIRECTIONAL_PRESETS = new Set<string>([
	'flyIn',
	'flyOut',
	'wipeIn',
	'wipeOut',
	'floatIn',
	'peekIn',
]);

// ==========================================================================
// Default values used when creating a new animation entry
// ==========================================================================

const DEFAULT_DURATION_MS = 500;
const DEFAULT_TRIGGER: PptxAnimationTrigger = 'onClick';

// ==========================================================================
// Readers
// ==========================================================================

/**
 * Returns the `PptxElementAnimation` for the given element id, or `undefined`
 * when none is present.
 *
 * @param slideAnimations - The full `PptxSlide.animations` array.
 * @param elementId - The target element's id.
 */
export function animationFor(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation | undefined {
	return slideAnimations.find((a) => a.elementId === elementId);
}

/**
 * Returns `true` when the element has at least one active effect (entrance,
 * exit, or emphasis) in the slide's animation list.
 */
export function hasAnimation(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): boolean {
	const entry = animationFor(slideAnimations, elementId);
	return Boolean(entry && (entry.entrance || entry.exit || entry.emphasis));
}

/**
 * Returns `true` when the active animation entry has a preset that supports
 * direction picking (fly in/out, wipe, etc.).
 */
export function showDirectionPicker(
	slideAnimations: readonly PptxElementAnimation[],
	elementId: string,
): boolean {
	const entry = animationFor(slideAnimations, elementId);
	if (!entry) {
		return false;
	}
	return DIRECTIONAL_PRESETS.has(entry.entrance ?? '') || DIRECTIONAL_PRESETS.has(entry.exit ?? '');
}

// ==========================================================================
// Immutable patch builders
// ==========================================================================

/**
 * Internal: upsert an animation entry for `elementId`, calling `updater` to
 * produce the merged record. When `updater` returns `null`, the entry is
 * removed. When no entry exists yet, one is created with sensible defaults
 * before being passed to `updater`.
 */
function upsert(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	updater: (current: PptxElementAnimation) => PptxElementAnimation | null,
): PptxElementAnimation[] {
	const idx = anims.findIndex((a) => a.elementId === elementId);
	if (idx >= 0) {
		const updated = updater({ ...anims[idx] });
		if (updated === null) {
			return anims.filter((a) => a.elementId !== elementId);
		}
		return anims.map((a, i) => (i === idx ? updated : a));
	}
	// No existing entry — create one and then apply the updater.
	const created: PptxElementAnimation = {
		elementId,
		durationMs: DEFAULT_DURATION_MS,
		order: anims.length,
		trigger: DEFAULT_TRIGGER,
	};
	const updated = updater(created);
	if (updated === null) {
		return [...anims];
	}
	return [...anims, updated];
}

/**
 * Sets (or clears when `preset` is `'none'` or `undefined`) the **entrance**
 * preset for the element. Removes the animation entry when all three effect
 * kinds become empty.
 *
 * @returns A new `PptxElementAnimation[]` with the change applied.
 */
export function setAnimationEntrance(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	preset: PptxAnimationPreset | 'none' | undefined,
): PptxElementAnimation[] {
	const value = preset === 'none' ? undefined : preset;
	return upsert(anims, elementId, (cur) => {
		const next: PptxElementAnimation = { ...cur, entrance: value };
		if (!next.entrance && !next.exit && !next.emphasis) {
			return null;
		}
		return next;
	});
}

/**
 * Sets (or clears) the **exit** preset for the element. Removes the entry
 * when all three effect kinds become empty.
 */
export function setAnimationExit(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	preset: PptxAnimationPreset | 'none' | undefined,
): PptxElementAnimation[] {
	const value = preset === 'none' ? undefined : preset;
	return upsert(anims, elementId, (cur) => {
		const next: PptxElementAnimation = { ...cur, exit: value };
		if (!next.entrance && !next.exit && !next.emphasis) {
			return null;
		}
		return next;
	});
}

/**
 * Sets (or clears) the **emphasis** preset for the element. Removes the entry
 * when all three effect kinds become empty.
 */
export function setAnimationEmphasis(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	preset: PptxAnimationPreset | 'none' | undefined,
): PptxElementAnimation[] {
	const value = preset === 'none' ? undefined : preset;
	return upsert(anims, elementId, (cur) => {
		const next: PptxElementAnimation = { ...cur, emphasis: value };
		if (!next.entrance && !next.exit && !next.emphasis) {
			return null;
		}
		return next;
	});
}

/**
 * Sets the trigger for the element's animation. When switching away from
 * `onShapeClick`, the `triggerShapeId` field is cleared.
 *
 * No-ops if the element has no animation entry.
 */
export function setTrigger(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	trigger: PptxAnimationTrigger,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => {
		const next: PptxElementAnimation = { ...cur, trigger };
		if (trigger !== 'onShapeClick') {
			next.triggerShapeId = undefined;
		}
		return next;
	});
}

/**
 * Sets the trigger shape id for `onShapeClick` interactive sequences.
 * Pass `undefined` to clear.
 */
export function setTriggerShapeId(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	triggerShapeId: string | undefined,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, triggerShapeId }));
}

/**
 * Sets the animation duration (clamped to 100–10 000 ms).
 */
export function setDuration(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	durationMs: number,
): PptxElementAnimation[] {
	const clamped = Math.max(100, Math.min(10000, durationMs));
	return upsert(anims, elementId, (cur) => ({ ...cur, durationMs: clamped }));
}

/**
 * Sets the animation delay (clamped to 0–10 000 ms).
 */
export function setDelay(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	delayMs: number,
): PptxElementAnimation[] {
	const clamped = Math.max(0, Math.min(10000, delayMs));
	return upsert(anims, elementId, (cur) => ({ ...cur, delayMs: clamped }));
}

/**
 * Sets the timing curve for the animation.
 */
export function setTimingCurve(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	timingCurve: PptxAnimationTimingCurve,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, timingCurve }));
}

/**
 * Sets the direction for directional entrance/exit effects.
 */
export function setDirection(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	direction: PptxAnimationDirection,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, direction }));
}

/**
 * Sets the sequence mode (asOne / byParagraph / byWord / byLetter).
 */
export function setSequence(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	sequence: PptxAnimationSequence,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, sequence }));
}

/**
 * Sets the repeat count (clamped to 1–100).
 */
export function setRepeatCount(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	repeatCount: number,
): PptxElementAnimation[] {
	const clamped = Math.max(1, Math.min(100, repeatCount));
	return upsert(anims, elementId, (cur) => ({ ...cur, repeatCount: clamped }));
}

/**
 * Sets or clears the repeat mode. Pass `'none'` or `undefined` to clear.
 */
export function setRepeatMode(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	repeatMode: PptxAnimationRepeatMode | 'none' | undefined,
): PptxElementAnimation[] {
	const value = repeatMode === 'none' ? undefined : repeatMode;
	return upsert(anims, elementId, (cur) => ({ ...cur, repeatMode: value }));
}

/**
 * Removes the animation entry for `elementId` entirely. Returns the original
 * array (by identity) when no entry exists.
 */
export function removeAnimation(
	anims: readonly PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	const idx = anims.findIndex((a) => a.elementId === elementId);
	if (idx < 0) {
		return [...anims];
	}
	const result = anims.filter((a) => a.elementId !== elementId);
	// Re-normalise `order` so there are no gaps.
	return reindexOrder(result);
}

/**
 * Moves the animation for `elementId` one position earlier in the `order`
 * sequence (swap with the entry whose `order` is one less). No-ops when
 * already first.
 */
export function reorderAnimationUp(
	anims: readonly PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	return reorderByDelta(anims, elementId, -1);
}

/**
 * Moves the animation for `elementId` one position later in the `order`
 * sequence. No-ops when already last.
 */
export function reorderAnimationDown(
	anims: readonly PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	return reorderByDelta(anims, elementId, +1);
}

// ==========================================================================
// Internal ordering helpers
// ==========================================================================

function reorderByDelta(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	delta: -1 | 1,
): PptxElementAnimation[] {
	// Work on a stable copy sorted by current order.
	const sorted = [...anims].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const idx = sorted.findIndex((a) => a.elementId === elementId);
	if (idx < 0) {
		return [...anims];
	}
	const swapIdx = idx + delta;
	if (swapIdx < 0 || swapIdx >= sorted.length) {
		return [...anims];
	}
	// Swap the two entries in the sorted list.
	const tmp = sorted[idx];
	sorted[idx] = sorted[swapIdx];
	sorted[swapIdx] = tmp;
	return reindexOrder(sorted);
}

/** Reassign monotonically increasing `order` values (0-based) after a swap or remove. */
function reindexOrder(anims: readonly PptxElementAnimation[]): PptxElementAnimation[] {
	return anims.map((a, i) => ({ ...a, order: i }));
}
