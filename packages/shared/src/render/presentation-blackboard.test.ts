import { describe, expect, it } from 'vitest';

import { PRESENT_TOOLBAR_METRICS } from './present-chrome';
import {
	PRESENT_ANNOTATION_OVER_BLACKOUT_Z,
	PRESENT_ANNOTATION_Z,
	PRESENT_BLACKOUT_Z,
	annotationCapturesPointer,
	annotationOverlayZIndex,
	isBlackboardActive,
	toggleBlackboard,
} from './presentation-blackboard';

describe('annotationOverlayZIndex (the layering decision)', () => {
	it('sits above the slide but below the blackout during a normal show', () => {
		expect(annotationOverlayZIndex('none')).toBe(PRESENT_ANNOTATION_Z);
		expect(PRESENT_ANNOTATION_Z).toBeLessThan(PRESENT_BLACKOUT_Z);
	});

	it('raises the ink above the blackout sheet while the screen is blanked', () => {
		expect(annotationOverlayZIndex('black')).toBe(PRESENT_ANNOTATION_OVER_BLACKOUT_Z);
		expect(annotationOverlayZIndex('white')).toBe(PRESENT_ANNOTATION_OVER_BLACKOUT_Z);
		expect(PRESENT_ANNOTATION_OVER_BLACKOUT_Z).toBeGreaterThan(PRESENT_BLACKOUT_Z);
	});

	it('never covers the show toolbar', () => {
		expect(PRESENT_ANNOTATION_OVER_BLACKOUT_Z).toBeLessThan(PRESENT_TOOLBAR_METRICS.zIndex);
	});
});

describe('annotationCapturesPointer', () => {
	it('claims the gesture for every drawing tool', () => {
		expect(annotationCapturesPointer('pen')).toBeTruthy();
		expect(annotationCapturesPointer('highlighter')).toBeTruthy();
		expect(annotationCapturesPointer('eraser')).toBeTruthy();
		expect(annotationCapturesPointer('laser')).toBeTruthy();
	});

	it('lets a press through to the show surface with no tool armed', () => {
		// PowerPoint still advances on a click while old ink is on screen.
		expect(annotationCapturesPointer('none')).toBeFalsy();
	});
});

describe('isBlackboardActive', () => {
	it('is active only for black screen + pen', () => {
		expect(isBlackboardActive('black', 'pen')).toBeTruthy();
		expect(isBlackboardActive('white', 'pen')).toBeFalsy();
		expect(isBlackboardActive('none', 'pen')).toBeFalsy();
		expect(isBlackboardActive('black', 'eraser')).toBeFalsy();
		expect(isBlackboardActive('black', 'none')).toBeFalsy();
	});
});

describe('toggleBlackboard', () => {
	it('arms blackout and pen together from an idle show', () => {
		expect(toggleBlackboard('none', 'none')).toStrictEqual({ blackout: 'black', tool: 'pen' });
	});

	it('completes the pair when only half the state is armed', () => {
		expect(toggleBlackboard('black', 'eraser')).toStrictEqual({ blackout: 'black', tool: 'pen' });
		expect(toggleBlackboard('none', 'pen')).toStrictEqual({ blackout: 'black', tool: 'pen' });
		expect(toggleBlackboard('white', 'pen')).toStrictEqual({ blackout: 'black', tool: 'pen' });
	});

	it('disarms both when blackboard mode is active', () => {
		expect(toggleBlackboard('black', 'pen')).toStrictEqual({ blackout: 'none', tool: 'none' });
	});
});
