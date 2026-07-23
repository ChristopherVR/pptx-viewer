import { PresentationAnimationController } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import type { TimelineClickGroup, TimelineStep } from '../../utils/animation-timeline';

function makeStep(overrides: Partial<TimelineStep>): TimelineStep {
	return {
		elementId: 'el',
		cssAnimation: '',
		keyframeName: '',
		trigger: 'onClick',
		delayMs: 0,
		durationMs: 500,
		fillMode: 'both',
		presetClass: 'entr',
		...overrides,
	} as TimelineStep;
}

function makeGroup(steps: TimelineStep[]): TimelineClickGroup {
	return { steps, totalDurationMs: 500 };
}

// `collectBuildStepIds` moved into the framework-agnostic controller in
// `pptx-viewer-shared`; the RAF-driven `driveBuildReveal` in build-playback.ts
// consumes it via `PresentationAnimationController.collectBuildStepIds`.
describe('presentationAnimationController.collectBuildStepIds', () => {
	it('returns ids only for steps carrying a staged build', () => {
		const group = makeGroup([
			makeStep({ elementId: 'plain' }),
			makeStep({ elementId: 'chart', build: { kind: 'chart', mode: 'bySeries' } }),
			makeStep({ elementId: 'dgm', build: { kind: 'diagram', mode: 'byOne' } }),
		]);
		expect(PresentationAnimationController.collectBuildStepIds(group)).toStrictEqual([
			'chart',
			'dgm',
		]);
	});

	it('returns an empty array when no step builds', () => {
		const group = makeGroup([makeStep({ elementId: 'a' }), makeStep({ elementId: 'b' })]);
		expect(PresentationAnimationController.collectBuildStepIds(group)).toStrictEqual([]);
	});
});
