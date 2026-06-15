// oxlint-disable react-hooks/rules-of-hooks
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import {
	buildStrokePathD,
	createStroke,
	eraseStrokesAtPoint,
	ERASER_RADIUS,
	HIGHLIGHTER_OPACITY,
	HIGHLIGHTER_WIDTH,
	PEN_WIDTH,
	usePresentationAnnotations,
} from './usePresentationAnnotations';
import type { AnnotationStroke } from './usePresentationAnnotations';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('createStroke', () => {
	it('builds an opaque thin pen stroke', () => {
		const stroke = createStroke('pen', 1, 2, '#ff0000', '#ffff00');
		expect(stroke.points).toStrictEqual([{ x: 1, y: 2 }]);
		expect(stroke.color).toBe('#ff0000');
		expect(stroke.width).toBe(PEN_WIDTH);
		expect(stroke.opacity).toBe(1);
		expect(stroke.id).toMatch(/^stroke-/u);
	});

	it('builds a wide translucent highlighter stroke', () => {
		const stroke = createStroke('highlighter', 3, 4, '#ff0000', '#ffff00');
		expect(stroke.color).toBe('#ffff00');
		expect(stroke.width).toBe(HIGHLIGHTER_WIDTH);
		expect(stroke.opacity).toBe(HIGHLIGHTER_OPACITY);
	});

	it('produces unique ids', () => {
		const a = createStroke('pen', 0, 0, '#000', '#fff');
		const b = createStroke('pen', 0, 0, '#000', '#fff');
		expect(a.id).not.toBe(b.id);
	});
});

describe('eraseStrokesAtPoint', () => {
	const stroke = (id: string, points: Array<{ x: number; y: number }>): AnnotationStroke => ({
		id,
		points,
		color: '#000',
		width: 2,
		opacity: 1,
	});

	it('removes strokes within the eraser radius', () => {
		const strokes = [stroke('a', [{ x: 100, y: 100 }]), stroke('b', [{ x: 0, y: 0 }])];
		const result = eraseStrokesAtPoint(strokes, 0, 0);
		expect(result).toHaveLength(1);
		expect(result[0]?.id).toBe('a');
	});

	it('returns the same array reference when nothing is erased', () => {
		const strokes = [stroke('a', [{ x: 500, y: 500 }])];
		const result = eraseStrokesAtPoint(strokes, 0, 0);
		expect(result).toBe(strokes);
	});

	it('respects the radius boundary', () => {
		const justOutside = ERASER_RADIUS + 1;
		const strokes = [stroke('a', [{ x: justOutside, y: 0 }])];
		expect(eraseStrokesAtPoint(strokes, 0, 0)).toBe(strokes);
		const justInside = ERASER_RADIUS - 1;
		const inside = [stroke('a', [{ x: justInside, y: 0 }])];
		expect(eraseStrokesAtPoint(inside, 0, 0)).toHaveLength(0);
	});
});

describe('buildStrokePathD', () => {
	it('returns empty string for no points', () => {
		expect(buildStrokePathD([])).toBe('');
	});

	it('builds an M/L polyline path', () => {
		expect(
			buildStrokePathD([
				{ x: 0, y: 0 },
				{ x: 10, y: 5 },
				{ x: 20, y: 15 },
			]),
		).toBe('M 0 0 L 10 5 L 20 15');
	});
});

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

describe('usePresentationAnnotations', () => {
	it('toggles a tool on/off and ignores tool changes while inactive', () => {
		const active = ref(true);
		const a = usePresentationAnnotations({ isActive: active, activeSlideIndex: ref(0) });
		a.setPresentationTool('pen');
		expect(a.presentationTool.value).toBe('pen');
		// Selecting the same tool again returns to none.
		a.setPresentationTool('pen');
		expect(a.presentationTool.value).toBe('none');

		active.value = false;
		a.setPresentationTool('pen');
		expect(a.presentationTool.value).toBe('none');
	});

	it('draws a pen stroke and commits it on pointer up', () => {
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: ref(0) });
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		a.handlePointerMove(10, 10);
		a.handlePointerMove(20, 20);
		expect(a.currentStroke.value?.points).toHaveLength(3);
		a.handlePointerUp();
		expect(a.currentStroke.value).toBeNull();
		expect(a.annotationStrokes.value).toHaveLength(1);
		expect(a.hasAnyAnnotations.value).toBeTruthy();
	});

	it('discards single-point strokes', () => {
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: ref(0) });
		a.setPresentationTool('pen');
		a.handlePointerDown(5, 5);
		a.handlePointerUp();
		expect(a.annotationStrokes.value).toHaveLength(0);
	});

	it('does not draw while inactive', () => {
		const active = ref(false);
		const a = usePresentationAnnotations({ isActive: active, activeSlideIndex: ref(0) });
		// Tool stays none while inactive, so no stroke begins.
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		expect(a.currentStroke.value).toBeNull();
	});

	it('tracks the laser position only with the laser tool active', () => {
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: ref(0) });
		a.handleLaserMove(1, 1);
		expect(a.laserPosition.value).toBeNull();
		a.setPresentationTool('laser');
		a.handleLaserMove(42, 24);
		expect(a.laserPosition.value).toStrictEqual({ x: 42, y: 24 });
		a.handleLaserLeave();
		expect(a.laserPosition.value).toBeNull();
	});

	it('erases strokes near a point with the eraser tool', () => {
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: ref(0) });
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		a.handlePointerMove(1, 1);
		a.handlePointerUp();
		expect(a.annotationStrokes.value).toHaveLength(1);

		a.setPresentationTool('eraser');
		a.eraseAtPoint(0, 0);
		expect(a.annotationStrokes.value).toHaveLength(0);
		expect(a.hasAnyAnnotations.value).toBeFalsy();
	});

	it('saves & restores strokes per slide', () => {
		const idx = ref(0);
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: idx });
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		a.handlePointerMove(1, 1);
		a.handlePointerUp();
		expect(a.annotationStrokes.value).toHaveLength(1);

		// Move to slide 1 — its strokes are empty.
		idx.value = 1;
		expect(a.annotationStrokes.value).toHaveLength(0);

		// Move back — slide 0's stroke is restored.
		idx.value = 0;
		expect(a.annotationStrokes.value).toHaveLength(1);

		// All-slide map carries the slide-0 stroke.
		expect(a.allSlideAnnotations.value.get(0)).toHaveLength(1);
	});

	it('clearAnnotations clears the active slide; clearAll clears everything', () => {
		const idx = ref(0);
		const a = usePresentationAnnotations({ isActive: ref(true), activeSlideIndex: idx });
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		a.handlePointerMove(1, 1);
		a.handlePointerUp();

		a.clearAnnotations();
		expect(a.annotationStrokes.value).toHaveLength(0);
		expect(a.hasAnyAnnotations.value).toBeFalsy();

		// Draw again on two slides, then clear all.
		a.handlePointerDown(0, 0);
		a.handlePointerMove(1, 1);
		a.handlePointerUp();
		idx.value = 1;
		a.handlePointerDown(0, 0);
		a.handlePointerMove(1, 1);
		a.handlePointerUp();
		a.clearAllAnnotations();
		expect(a.hasAnyAnnotations.value).toBeFalsy();
		expect(a.allSlideAnnotations.value.size).toBe(0);
	});

	it('resets transient state when deactivated', () => {
		const active = ref(true);
		const a = usePresentationAnnotations({ isActive: active, activeSlideIndex: ref(0) });
		a.setPresentationTool('pen');
		a.handlePointerDown(0, 0);
		active.value = false;
		expect(a.presentationTool.value).toBe('none');
		expect(a.currentStroke.value).toBeNull();
	});
});
