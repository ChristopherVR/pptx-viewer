import type { AnimationCondition, PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	resolveEffectiveStartCondition,
	resolveEffectiveEndCondition,
	resolveAnimationStart,
	resolveAnimationEnd,
} from './animation-advanced-triggers';

// ==========================================================================
// resolveEffectiveStartCondition
// ==========================================================================

describe('resolveEffectiveStartCondition', () => {
	it('falls back to the simple trigger when no conditions are present', () => {
		const result = resolveEffectiveStartCondition(undefined, 'afterPrevious');
		expect(result.trigger).toBe('afterPrevious');
		expect(result.delayMs).toBe(0);
		expect(result.hasClickAlternative).toBeFalsy();
	});

	it('treats a single click condition as onClick', () => {
		const conds: AnimationCondition[] = [{ event: 'onClick', delay: 0 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('onClick');
		expect(result.hasClickAlternative).toBeTruthy();
	});

	it('keeps a shape click as onShapeClick and records its target', () => {
		const conds: AnimationCondition[] = [{ event: 'onClick', delay: 0, targetShapeId: 'btn1' }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('onShapeClick');
		expect(result.clickTargetShapeId).toBe('btn1');
	});

	// Compound: "fire on click OR after a delay" -> auto plays after delay,
	// but a click can start it sooner.
	it('handles compound click-OR-delay: auto after delay, click alternative kept', () => {
		const conds: AnimationCondition[] = [{ event: 'onClick', delay: 0 }, { delay: 1500 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('onClick');
		expect(result.delayMs).toBe(1500);
		expect(result.hasClickAlternative).toBeTruthy();
	});

	it('handles a pure delay condition as afterDelay', () => {
		const conds: AnimationCondition[] = [{ delay: 2000 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('afterDelay');
		expect(result.delayMs).toBe(2000);
		expect(result.hasClickAlternative).toBeFalsy();
	});

	// Compound "after multiple preceding effects": waits on a time node end.
	it('sequences after a time-node end dependency (onEnd of tn)', () => {
		const conds: AnimationCondition[] = [{ event: 'onEnd', delay: 0, targetTimeNodeId: 7 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('afterPrevious');
		expect(result.dependsOnTimeNodeId).toBe(7);
		expect(result.dependsOnEvent).toBe('onEnd');
	});

	it('sequences with a time-node begin dependency (onBegin of tn)', () => {
		const conds: AnimationCondition[] = [{ event: 'onBegin', delay: 0, targetTimeNodeId: 3 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('withPrevious');
		expect(result.dependsOnTimeNodeId).toBe(3);
	});

	it('prefers the time-node dependency when both a click and a tn-end exist', () => {
		const conds: AnimationCondition[] = [
			{ event: 'onClick', delay: 0 },
			{ event: 'onEnd', delay: 0, targetTimeNodeId: 5 },
		];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.trigger).toBe('afterPrevious');
		expect(result.dependsOnTimeNodeId).toBe(5);
		expect(result.hasClickAlternative).toBeTruthy();
	});

	it('picks the smallest delay among multiple delay conditions', () => {
		const conds: AnimationCondition[] = [{ delay: 3000 }, { delay: 800 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.delayMs).toBe(800);
	});

	it('marks an indefinite delay condition as indefinite', () => {
		const conds: AnimationCondition[] = [{ delay: -1 }];
		const result = resolveEffectiveStartCondition(conds, 'onClick');
		expect(result.indefinite).toBeTruthy();
		expect(result.delayMs).toBe(0);
	});

	it('records a hover alternative from onMouseOver', () => {
		const conds: AnimationCondition[] = [{ event: 'onMouseOver', delay: 0 }];
		const result = resolveEffectiveStartCondition(conds, 'onHover');
		expect(result.trigger).toBe('onHover');
		expect(result.hasHoverAlternative).toBeTruthy();
	});
});

describe('resolveAnimationStart', () => {
	it('reads conditions off a native animation', () => {
		const anim = {
			targetId: 'el1',
			trigger: 'onClick',
			startConditions: [{ delay: 1000 }],
		} as PptxNativeAnimation;
		const result = resolveAnimationStart(anim);
		expect(result.trigger).toBe('afterDelay');
		expect(result.delayMs).toBe(1000);
	});

	it('uses the simple trigger when no startConditions exist', () => {
		const anim = {
			targetId: 'el1',
			trigger: 'withPrevious',
		} as PptxNativeAnimation;
		expect(resolveAnimationStart(anim).trigger).toBe('withPrevious');
	});
});

// ==========================================================================
// resolveEffectiveEndCondition
// ==========================================================================

describe('resolveEffectiveEndCondition', () => {
	it('returns undefined when no end conditions exist', () => {
		expect(resolveEffectiveEndCondition(undefined)).toBeUndefined();
		expect(resolveEffectiveEndCondition([])).toBeUndefined();
	});

	it('detects mouse-out as the reverse/stop end event', () => {
		const result = resolveEffectiveEndCondition([{ event: 'onMouseOut', delay: 0 }]);
		expect(result?.endsOnMouseOut).toBeTruthy();
	});

	it('detects a click end with a target shape', () => {
		const result = resolveEffectiveEndCondition([
			{ event: 'onClick', delay: 0, targetShapeId: 'btn1' },
		]);
		expect(result?.endsOnClick).toBeTruthy();
		expect(result?.clickTargetShapeId).toBe('btn1');
	});

	it('detects a time-node end dependency and a finite delay together', () => {
		const result = resolveEffectiveEndCondition([
			{ event: 'onEnd', delay: 0, targetTimeNodeId: 4 },
			{ delay: 2500 },
		]);
		expect(result?.endsWithTimeNodeId).toBe(4);
		expect(result?.delayMs).toBe(2500);
	});

	it('marks an indefinite end', () => {
		const result = resolveEffectiveEndCondition([{ delay: -1 }]);
		expect(result?.indefinite).toBeTruthy();
	});
});

describe('resolveAnimationEnd', () => {
	it('reads end conditions off a native animation', () => {
		const anim = {
			targetId: 'el1',
			endConditions: [{ event: 'onMouseOut', delay: 0 }],
		} as PptxNativeAnimation;
		expect(resolveAnimationEnd(anim)?.endsOnMouseOut).toBeTruthy();
	});
});
