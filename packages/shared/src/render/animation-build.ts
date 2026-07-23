/**
 * `animation-build`: staged-build (`p:bldChart` / `p:bldDgm`) resolution for
 * the native-animation timeline. Maps the parsed OOXML build tokens carried on
 * a {@link PptxNativeAnimation} to the normalized {@link StepBuildDescriptor}
 * mode, plus the pure time->progress and progress->count helpers a staged
 * chart / SmartArt renderer needs. Framework-free, no DOM.
 *
 * @module render/animation-build
 */

import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type {
	ChartBuildMode,
	DiagramBuildMode,
	ElementAnimationState,
	StepBuildDescriptor,
	TimelineStep,
} from './animation-timeline-types';

/** Options controlling how staged-build progress is resolved onto a state. */
export interface ElementBuildStateOptions {
	/**
	 * Milliseconds elapsed since the revealing step's click-group started. When
	 * provided, a staged-build element's `build.progress` is computed from the
	 * step's delay/duration at this time; when omitted, `progress` is `1` (the
	 * build is treated as fully revealed, matching discrete click semantics).
	 */
	elapsedMs?: number;
}

// ==========================================================================
// OOXML build-token -> normalized mode mapping
// ==========================================================================

/**
 * Map a chart build token (`a:bldChart/@bld` or `p:bldOleChart/@bld`) to the
 * normalized {@link ChartBuildMode}. Unknown tokens fall back to `asOne` so an
 * unrecognised build never staggers unexpectedly.
 */
export function resolveChartBuildMode(token: string | undefined): ChartBuildMode {
	switch (token) {
		case 'series':
			return 'bySeries';
		case 'category':
			return 'byCategory';
		case 'seriesElement':
		case 'seriesEl':
		case 'categoryElement':
		case 'categoryEl':
			return 'byElement';
		default:
			return 'asOne';
	}
}

/**
 * Map a diagram build token to the normalized {@link DiagramBuildMode}. Handles
 * both the `a:bldDgm/@bld` set (`allAtOnce`/`one`/`lvlOne`/`lvlAtOnce`) and the
 * broader `p:bldDgm/@bld` set (`whole`, `depthBy*`, `breadthBy*`, directional
 * traversals). `whole`/`allAtOnce` reveal at once; everything staged that is
 * not an explicit level build reveals node-by-node (`byOne`).
 */
export function resolveDiagramBuildMode(token: string | undefined): DiagramBuildMode {
	switch (token) {
		case undefined:
		case 'whole':
		case 'allAtOnce':
			return 'asOne';
		case 'lvlOne':
			return 'byLvl';
		case 'lvlAtOnce':
			return 'byLvlAtOnce';
		default:
			// `one`, `depthByNode`, `breadthByNode`, `cw`, `ccw`, `inByRing`, ...
			return 'byOne';
	}
}

/**
 * Derive the static staged-build descriptor for a native animation from its
 * parsed `graphicBuildProperties` (chart / diagram sub-builds) and
 * `smartArtBuild` (`p:bldDgm/@bld`) fields.
 *
 * Returns `undefined` when the animation carries no staged build, or when the
 * build resolves to a whole-element reveal (`asOne`) that a staged renderer
 * would treat identically to the existing whole-element entrance, so callers
 * only attach a descriptor when it actually changes reveal behaviour.
 */
export function resolveStepBuildDescriptor(
	anim: PptxNativeAnimation,
): StepBuildDescriptor | undefined {
	const graphic = anim.graphicBuildProperties;
	if (graphic && graphic.mode === 'sub') {
		if (graphic.kind === 'chart') {
			const mode = resolveChartBuildMode(graphic.build);
			return mode === 'asOne' ? undefined : { kind: 'chart', mode };
		}
		const mode = resolveDiagramBuildMode(graphic.build);
		return mode === 'asOne' ? undefined : { kind: 'diagram', mode };
	}

	// `p:bldOleChart/@bld` staged build for an OLE-embedded chart graphic frame.
	if (anim.oleChartBuild !== undefined) {
		const mode = resolveChartBuildMode(anim.oleChartBuild);
		return mode === 'asOne' ? undefined : { kind: 'chart', mode };
	}

	// `p:bldDgm/@bld` diagram build attached directly (no bldGraphic sub-choice).
	if (anim.smartArtBuild !== undefined) {
		const mode = resolveDiagramBuildMode(anim.smartArtBuild);
		return mode === 'asOne' ? undefined : { kind: 'diagram', mode };
	}

	return undefined;
}

// ==========================================================================
// Playback-time progress helpers
// ==========================================================================

/** Clamp a value into the closed unit interval. */
function clamp01(value: number): number {
	return Math.max(0, Math.min(1, value));
}

/**
 * Compute the 0..1 build progress at a playback time.
 *
 * @param timing - The revealing step's `delayMs` (relative to its click-group
 *   start) and `durationMs`.
 * @param elapsedMs - Milliseconds elapsed since the click-group started.
 * @returns 0 before the step's delay elapses, ramping linearly to 1 at
 *   `delayMs + durationMs`. A non-positive duration snaps straight to 1.
 */
export function computeBuildProgress(
	timing: { delayMs: number; durationMs: number },
	elapsedMs: number,
): number {
	if (timing.durationMs <= 0) {
		return elapsedMs >= timing.delayMs ? 1 : 0;
	}
	return clamp01((elapsedMs - timing.delayMs) / timing.durationMs);
}

/**
 * Map a 0..1 build progress to a whole number of revealed stages given the
 * renderer's own stage COUNT (series / categories / levels / nodes).
 *
 * The reveal is inclusive at the leading edge: progress `0` reveals nothing,
 * any progress above `0` reveals at least one stage, and progress `1` reveals
 * every stage. A consumer treats the returned integer as "reveal the first N
 * stages" for its build mode.
 */
export function revealedStageCount(progress: number, totalStages: number): number {
	if (totalStages <= 0) {
		return 0;
	}
	const p = clamp01(progress);
	if (p <= 0) {
		return 0;
	}
	return Math.min(totalStages, Math.ceil(p * totalStages));
}

// ==========================================================================
// State folding
// ==========================================================================

/**
 * Fold a revealing step's staged-build + colour-target descriptors onto an
 * {@link ElementAnimationState}. Mutates `state` in place, adding `build`
 * (with progress resolved at `options.elapsedMs`), `animatesFill`, and
 * `animatesStroke` only when the step actually carries those descriptors, so a
 * plain whole-element entrance leaves the state untouched.
 */
export function applyStepBuildMetadata(
	state: ElementAnimationState,
	step: TimelineStep | undefined,
	options?: ElementBuildStateOptions,
): void {
	if (!step) {
		return;
	}
	if (step.build) {
		const progress =
			options?.elapsedMs === undefined ? 1 : computeBuildProgress(step, options.elapsedMs);
		state.build = { ...step.build, progress };
	}
	if (step.colorTargets) {
		if (step.colorTargets.includes('fill')) {
			state.animatesFill = true;
		}
		if (step.colorTargets.includes('stroke')) {
			state.animatesStroke = true;
		}
	}
}
