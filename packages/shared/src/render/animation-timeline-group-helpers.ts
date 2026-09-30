import type { PptxNativeAnimation } from 'pptx-viewer-core';

import type {
	AnimationStep,
	EffectName,
	TimelineStep,
	TimelineClickGroup,
} from './animation-timeline-types';

// ==========================================================================
// Naming, durations, fill modes, group finalisation
// ==========================================================================

export function cssKeyframeName(effect: EffectName | string): string {
	return `pptx-${effect}`;
}

export function defaultDuration(presetClass: PptxNativeAnimation['presetClass']): number {
	switch (presetClass) {
		case 'entr':
			return 500;
		case 'exit':
			return 500;
		case 'emph':
			return 800;
		case 'path':
			return 1000;
		default:
			return 500;
	}
}

export function fillModeForClass(
	presetClass: PptxNativeAnimation['presetClass'],
): AnimationStep['fillMode'] {
	switch (presetClass) {
		case 'entr':
			return 'both';
		case 'exit':
			return 'forwards';
		case 'emph':
			return 'both';
		default:
			return 'both';
	}
}

export function finalizeClickGroup(
	steps: TimelineStep[],
	options?: { autoAdvance?: boolean; autoAdvanceDelayMs?: number },
): TimelineClickGroup {
	let maxEnd = 0;
	for (const step of steps) {
		const end = step.delayMs + step.durationMs;
		if (end > maxEnd) {
			maxEnd = end;
		}
	}
	const group: TimelineClickGroup = { steps, totalDurationMs: maxEnd };
	if (options?.autoAdvance) {
		group.autoAdvance = true;
		group.autoAdvanceDelayMs = options.autoAdvanceDelayMs ?? 0;
	}
	// `@concurrent`/`@nextAc`/`@prevAc` are constant across every step governed
	// by the same enclosing `p:seq` (ECMA-376 S19.5.60), so the first step that
	// carries one speaks for the whole group.
	for (const step of steps) {
		if (group.seqConcurrent === undefined && step.seqConcurrent !== undefined) {
			group.seqConcurrent = step.seqConcurrent;
		}
		if (group.seqNextAction === undefined && step.seqNextAction !== undefined) {
			group.seqNextAction = step.seqNextAction;
		}
		if (group.seqPrevAction === undefined && step.seqPrevAction !== undefined) {
			group.seqPrevAction = step.seqPrevAction;
		}
	}
	return group;
}
