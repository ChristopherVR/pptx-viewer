import type { PptxNativeAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { BACKGROUND_ANIMATION_ID_SUFFIX, resolveAnimationTargetId } from './animation-target-id';

function makeAnim(overrides: Partial<PptxNativeAnimation> = {}): PptxNativeAnimation {
	return { targetId: 'el1', ...overrides } as PptxNativeAnimation;
}

describe('resolveAnimationTargetId', () => {
	it('returns the plain targetId when there is no shape target', () => {
		expect(resolveAnimationTargetId(makeAnim())).toBe('el1');
	});

	it('prefers a p:subSp sub-shape id over the enclosing group id (G1)', () => {
		const anim = makeAnim({
			targetId: '4',
			target: { type: 'shape', shapeId: '4', subShapeId: '3' },
		});
		expect(resolveAnimationTargetId(anim)).toBe('3');
	});

	it('still applies the background-only suffix when the target is a sub-shape', () => {
		const anim = makeAnim({
			targetId: '4',
			target: { type: 'shape', shapeId: '4', subShapeId: '3', backgroundOnly: true },
		});
		expect(resolveAnimationTargetId(anim)).toBe(`3${BACKGROUND_ANIMATION_ID_SUFFIX}`);
	});

	it('falls back to targetId when the shape target has no subShapeId', () => {
		const anim = makeAnim({
			targetId: '4',
			target: { type: 'shape', shapeId: '4' },
		});
		expect(resolveAnimationTargetId(anim)).toBe('4');
	});
});
