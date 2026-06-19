/**
 * `animation-authoring` — pure, immutable helpers for the editor's element
 * animation authoring UI (the Animations ribbon tab / animation panel).
 *
 * Animation data lives on the SLIDE (`PptxSlide.animations`), keyed by
 * `elementId`, NOT on the element itself. The authoring UI reads and emits the
 * entire slide-level `animations` array. Every function here returns a new
 * `PptxElementAnimation[]` without mutating its input, so they're trivially
 * unit-testable and safe to drive editor undo/redo from.
 *
 * Two families coexist here, both used across the bindings:
 *
 *  - **Granular field setters** (`setAnimationEntrance` / `setTrigger` /
 *    `setDuration` / … plus `reorderAnimationUp` / `removeAnimation`): the
 *    Angular authoring panel + React's `useAnimationHandlers` model. They
 *    upsert a single field on the element's entry, creating the entry with
 *    sensible defaults when absent and removing it when all three effect
 *    buckets become empty.
 *  - **Group preset apply/remove** (`applyAnimationPreset` /
 *    `removeElementAnimation`): the Vue ribbon model, a coarser
 *    "set one of entrance/emphasis/exit, keep the rest" upsert.
 *
 * The option *catalogs* here are intentionally **value-only** (preset id +
 * nothing else): the human label / icon / i18n key for each option is
 * framework-specific (React uses `react-icons` + label keys, Angular uses
 * Unicode arrow glyphs + plain labels), so each binding maps these ids to its
 * own display metadata.
 *
 * Pure: imports only `pptx-viewer-core` types; no framework, no DOM.
 *
 * @module render/animation-authoring
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

/** One of the three animation buckets a preset can occupy on an element. */
export type AnimationGroup = 'entrance' | 'emphasis' | 'exit';

// ==========================================================================
// Option catalogs (value-only — bindings supply labels/icons)
// ==========================================================================

/** Entrance presets surfaced in the authoring UI (superset across bindings). */
export const ENTRANCE_PRESET_VALUES: readonly PptxAnimationPreset[] = [
	'appear',
	'fadeIn',
	'flyIn',
	'zoomIn',
	'bounceIn',
	'wipeIn',
	'splitIn',
	'dissolveIn',
	'floatIn',
	'growTurnIn',
];

/** Exit presets surfaced in the authoring UI. */
export const EXIT_PRESET_VALUES: readonly PptxAnimationPreset[] = [
	'fadeOut',
	'flyOut',
	'zoomOut',
	'bounceOut',
	'wipeOut',
	'shrinkOut',
	'dissolveOut',
	'disappear',
];

/** Emphasis presets surfaced in the authoring UI. */
export const EMPHASIS_PRESET_VALUES: readonly PptxAnimationPreset[] = [
	'spin',
	'pulse',
	'colorWave',
	'bounce',
	'flash',
	'growShrink',
	'teeter',
	'wave',
	'boldFlash',
];

/** Trigger option values for the trigger selector. */
export const TRIGGER_VALUES: readonly PptxAnimationTrigger[] = [
	'onClick',
	'onShapeClick',
	'onHover',
	'afterPrevious',
	'withPrevious',
];

/** Timing-curve option values. */
export const TIMING_CURVE_VALUES: readonly PptxAnimationTimingCurve[] = [
	'ease',
	'ease-in',
	'ease-out',
	'linear',
];

/** Repeat-mode option values (`'none'` means clear the field). */
export const REPEAT_MODE_VALUES: readonly ('none' | PptxAnimationRepeatMode)[] = [
	'none',
	'untilNextClick',
	'untilEndOfSlide',
];

/** Direction option values for directional presets (fly in/out, wipe). */
export const DIRECTION_VALUES: readonly PptxAnimationDirection[] = [
	'fromTop',
	'fromBottom',
	'fromLeft',
	'fromRight',
	'fromTopLeft',
	'fromTopRight',
	'fromBottomLeft',
	'fromBottomRight',
];

/** Sequence option values for paragraph/word/letter builds. */
export const SEQUENCE_VALUES: readonly PptxAnimationSequence[] = [
	'asOne',
	'byParagraph',
	'byWord',
	'byLetter',
];

/**
 * Presets that expose the direction picker. Superset of the per-binding sets
 * (Angular surfaced more directional presets than React's `flyIn`/`flyOut`).
 */
export const DIRECTIONAL_PRESETS = new Set<string>([
	'flyIn',
	'flyOut',
	'wipeIn',
	'wipeOut',
	'floatIn',
	'peekIn',
]);

// ==========================================================================
// Defaults for a freshly-created animation entry
// ==========================================================================

const DEFAULT_DURATION_MS = 500;
const DEFAULT_TRIGGER: PptxAnimationTrigger = 'onClick';

// ==========================================================================
// Readers
// ==========================================================================

/**
 * Returns the `PptxElementAnimation` for the given element id, or `undefined`
 * when none is present.
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
// Immutable patch builders — granular field setters
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

function setEffect(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	group: AnimationGroup,
	preset: PptxAnimationPreset | 'none' | undefined,
): PptxElementAnimation[] {
	const value = preset === 'none' ? undefined : preset;
	return upsert(anims, elementId, (cur) => {
		const next: PptxElementAnimation = { ...cur, [group]: value };
		if (!next.entrance && !next.exit && !next.emphasis) {
			return null;
		}
		return next;
	});
}

/**
 * Sets (or clears when `preset` is `'none'` or `undefined`) the **entrance**
 * preset for the element. Removes the animation entry when all three effect
 * kinds become empty.
 */
export function setAnimationEntrance(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	preset: PptxAnimationPreset | 'none' | undefined,
): PptxElementAnimation[] {
	return setEffect(anims, elementId, 'entrance', preset);
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
	return setEffect(anims, elementId, 'exit', preset);
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
	return setEffect(anims, elementId, 'emphasis', preset);
}

/**
 * Sets the trigger for the element's animation. When switching away from
 * `onShapeClick`, the `triggerShapeId` field is cleared.
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

/** Sets the animation duration (clamped to 100–10 000 ms). */
export function setDuration(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	durationMs: number,
): PptxElementAnimation[] {
	const clamped = Math.max(100, Math.min(10000, durationMs));
	return upsert(anims, elementId, (cur) => ({ ...cur, durationMs: clamped }));
}

/** Sets the animation delay (clamped to 0–10 000 ms). */
export function setDelay(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	delayMs: number,
): PptxElementAnimation[] {
	const clamped = Math.max(0, Math.min(10000, delayMs));
	return upsert(anims, elementId, (cur) => ({ ...cur, delayMs: clamped }));
}

/** Sets the timing curve for the animation. */
export function setTimingCurve(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	timingCurve: PptxAnimationTimingCurve,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, timingCurve }));
}

/** Sets the direction for directional entrance/exit effects. */
export function setDirection(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	direction: PptxAnimationDirection,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, direction }));
}

/** Sets the sequence mode (asOne / byParagraph / byWord / byLetter). */
export function setSequence(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	sequence: PptxAnimationSequence,
): PptxElementAnimation[] {
	return upsert(anims, elementId, (cur) => ({ ...cur, sequence }));
}

/** Sets the repeat count (clamped to 1–100). */
export function setRepeatCount(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	repeatCount: number,
): PptxElementAnimation[] {
	const clamped = Math.max(1, Math.min(100, repeatCount));
	return upsert(anims, elementId, (cur) => ({ ...cur, repeatCount: clamped }));
}

/** Sets or clears the repeat mode. Pass `'none'` or `undefined` to clear. */
export function setRepeatMode(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	repeatMode: PptxAnimationRepeatMode | 'none' | undefined,
): PptxElementAnimation[] {
	const value = repeatMode === 'none' ? undefined : repeatMode;
	return upsert(anims, elementId, (cur) => ({ ...cur, repeatMode: value }));
}

/**
 * Removes the animation entry for `elementId` entirely and re-normalises
 * `order` so there are no gaps. Returns a copy when no entry exists.
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
	return reindexOrder(result);
}

/**
 * Moves the animation for `elementId` one position earlier in the `order`
 * sequence. No-ops when already first.
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
// Immutable patch builders — coarse group preset apply/remove (Vue model)
// ==========================================================================

/**
 * Return `animations` with `preset` applied to `elementId`'s `group` slot. If
 * the element already has an entry its `group` field is replaced; otherwise a
 * new entry is appended (500ms, on-click, ordered after the existing ones).
 *
 * Unlike {@link setAnimationEntrance} this never removes the entry and only
 * touches the targeted bucket — it is the simpler "ribbon button" model.
 */
export function applyAnimationPreset(
	animations: PptxElementAnimation[],
	elementId: string,
	group: AnimationGroup,
	preset: PptxAnimationPreset,
): PptxElementAnimation[] {
	const exists = animations.some((a) => a.elementId === elementId);
	if (exists) {
		return animations.map((a) => (a.elementId === elementId ? { ...a, [group]: preset } : a));
	}
	return [
		...animations,
		{
			elementId,
			[group]: preset,
			durationMs: DEFAULT_DURATION_MS,
			order: animations.length,
			trigger: DEFAULT_TRIGGER,
		} satisfies PptxElementAnimation,
	];
}

/** Return `animations` without the entry for `elementId`. */
export function removeElementAnimation(
	animations: PptxElementAnimation[],
	elementId: string,
): PptxElementAnimation[] {
	return animations.filter((a) => a.elementId !== elementId);
}

// ==========================================================================
// Internal ordering helpers
// ==========================================================================

function reorderByDelta(
	anims: readonly PptxElementAnimation[],
	elementId: string,
	delta: -1 | 1,
): PptxElementAnimation[] {
	const sorted = [...anims].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const idx = sorted.findIndex((a) => a.elementId === elementId);
	if (idx < 0) {
		return [...anims];
	}
	const swapIdx = idx + delta;
	if (swapIdx < 0 || swapIdx >= sorted.length) {
		return [...anims];
	}
	const tmp = sorted[idx];
	sorted[idx] = sorted[swapIdx];
	sorted[swapIdx] = tmp;
	return reindexOrder(sorted);
}

/** Reassign monotonically increasing `order` values (0-based) after a swap or remove. */
function reindexOrder(anims: readonly PptxElementAnimation[]): PptxElementAnimation[] {
	return anims.map((a, i) => ({ ...a, order: i }));
}
