import type { RibbonTransitionPreset } from 'pptx-viewer-shared';
import {
	DEFAULT_RIBBON_TRANSITION_DURATION_SEC,
	RIBBON_TRANSITION_PRESETS,
} from 'pptx-viewer-shared';

/**
 * The Transitions tab's gallery, re-exported from `pptx-viewer-shared`.
 *
 * The list itself used to be a hand-copied array per binding, which is exactly
 * how five galleries drift apart entry by entry. It now lives in
 * `render/ribbon-transitions`; this module survives only so the existing
 * `TRANSITION_PRESETS` / `DEFAULT_TRANSITION_DURATION_SEC` importers keep
 * resolving, and must never grow a second source of truth.
 */

/** @deprecated Use `RibbonTransitionPreset` from `pptx-viewer-shared`. */
export type TransitionPreset = RibbonTransitionPreset;

/** Transition presets surfaced in the gallery (matches the `pptx.ribbon.transition.*` i18n keys). */
export const TRANSITION_PRESETS: readonly RibbonTransitionPreset[] = RIBBON_TRANSITION_PRESETS;

/** Default duration (seconds) seeded into the Transitions tab's duration field. */
export const DEFAULT_TRANSITION_DURATION_SEC = DEFAULT_RIBBON_TRANSITION_DURATION_SEC;
