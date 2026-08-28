import type { PptxNativeAnimation, PptxSlide, PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { TimelineClickGroup, TimelineStep } from './animation-timeline-types';
import { PresentationAnimationController } from './presentation-animation-controller';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function textElement(id: string, text: string): PptxElement {
	// A minimal text element carrying `textSegments` so text-build expansion can
	// count paragraphs / words / chars.
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text,
		textSegments: [{ text }],
	} as unknown as PptxElement;
}

function multiParaTextElement(id: string, paragraphs: string[]): PptxElement {
	const segments: Array<{ text: string }> = [];
	paragraphs.forEach((p, i) => {
		if (i > 0) {
			segments.push({ text: '\n' });
		}
		segments.push({ text: p });
	});
	return {
		type: 'text',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		text: paragraphs.join('\n'),
		textSegments: segments,
	} as unknown as PptxElement;
}

function shapeElement(id: string): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 100,
		height: 100,
	} as unknown as PptxElement;
}

function slideWith(elements: PptxElement[], nativeAnimations?: PptxNativeAnimation[]): PptxSlide {
	return {
		id: 'slide-1',
		elements,
		nativeAnimations,
	} as unknown as PptxSlide;
}

function entranceAnim(targetId: string): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		trigger: 'onClick',
	} as unknown as PptxNativeAnimation;
}

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('presentationAnimationController.fromSlide', () => {
	it('tracks every element id when the slide has no animations', () => {
		const slide = slideWith([shapeElement('a'), shapeElement('b')]);
		const controller = PresentationAnimationController.fromSlide(slide);

		expect([...controller.elementIds]).toStrictEqual(['a', 'b']);
		expect(controller.keyframesCss).toBeTypeOf('string');
		expect(controller.interactiveTriggerShapeIds.size).toBe(0);
		expect(controller.hoverTriggerShapeIds.size).toBe(0);
	});

	it('seeds a hidden state for an element with a pending entrance', () => {
		const slide = slideWith([shapeElement('a'), shapeElement('b')], [entranceAnim('a')]);
		const controller = PresentationAnimationController.fromSlide(slide);

		const states = controller.computeStates();
		// `a` has an unplayed entrance -> hidden; `b` has none -> visible.
		expect(states.get('a')?.visible).toBeFalsy();
		expect(states.get('b')?.visible).toBeTruthy();
	});

	it('keeps text visible while a background-only entrance is pending', () => {
		const animation = {
			...entranceAnim('a'),
			target: { type: 'shape', shapeId: 'a', backgroundOnly: true },
		} as PptxNativeAnimation;
		const controller = PresentationAnimationController.fromSlide(
			slideWith([shapeElement('a')], [animation]),
		);

		expect(controller.elementIds).toContain('a::pptx-bg');
		const states = controller.computeStates();
		expect(states.get('a')?.visible).toBeTruthy();
		expect(states.get('a::pptx-bg')?.visible).toBeFalsy();
	});

	it('reveals a pending entrance after advancing its click-group', () => {
		const slide = slideWith([shapeElement('a')], [entranceAnim('a')]);
		const controller = PresentationAnimationController.fromSlide(slide);

		expect(controller.hasMoreSteps()).toBeTruthy();
		const group = controller.advance();
		expect(group).not.toBeNull();

		const states = controller.computeStates();
		expect(states.get('a')?.visible).toBeTruthy();
		expect(controller.hasMoreSteps()).toBeFalsy();
	});

	it('expands a text-build animation into sub-element ids', () => {
		const slide = slideWith(
			[textElement('t', 'one two three')],
			[
				{
					targetId: 't',
					presetClass: 'entr',
					trigger: 'onClick',
					buildType: 'byWord',
				} as unknown as PptxNativeAnimation,
			],
		);
		const controller = PresentationAnimationController.fromSlide(slide);

		// Base id plus at least one text-build sub-element id (separator "::").
		expect(controller.elementIds).toContain('t');
		expect(controller.elementIds.some((id) => id.includes('::'))).toBeTruthy();
	});

	it('scopes a p:txEl/pRg entrance to only the named paragraphs, not the whole text box', () => {
		const slide = slideWith(
			[multiParaTextElement('t', ['first', 'second', 'third'])],
			[
				{
					targetId: 't',
					presetClass: 'entr',
					trigger: 'onClick',
					textTarget: { type: 'pRg', start: 1, end: 2 },
				} as unknown as PptxNativeAnimation,
			],
		);
		const controller = PresentationAnimationController.fromSlide(slide);

		// The scoped sub-element is tracked; the whole shape stays visible
		// throughout (only paragraph 1 has an entrance to hide/reveal).
		expect(controller.elementIds).toContain('t::p1');
		expect(controller.computeStates().get('t')?.visible).toBeTruthy();
		expect(controller.computeStates().get('t::p1')?.visible).toBeFalsy();

		controller.advance();
		expect(controller.computeStates().get('t::p1')?.visible).toBeTruthy();
	});

	it('reset returns the timeline to the initial (nothing played) state', () => {
		const slide = slideWith([shapeElement('a')], [entranceAnim('a')]);
		const controller = PresentationAnimationController.fromSlide(slide);

		controller.advance();
		expect(controller.computeStates().get('a')?.visible).toBeTruthy();

		controller.reset();
		expect(controller.computeStates().get('a')?.visible).toBeFalsy();
		expect(controller.hasMoreSteps()).toBeTruthy();
	});
});

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

describe('presentationAnimationController.computeStatesFor', () => {
	it('computes state for a subset of ids only', () => {
		const slide = slideWith([shapeElement('a'), shapeElement('b')]);
		const controller = PresentationAnimationController.fromSlide(slide);

		const states = controller.computeStatesFor(['b']);
		expect([...states.keys()]).toStrictEqual(['b']);
	});
});
