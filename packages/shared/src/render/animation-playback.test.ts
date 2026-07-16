/**
 * animation-playback.test.ts — unit tests for the pure click-stepped playback
 * helpers. Ported from the Angular `animation-playback-helpers.test.ts` (which
 * itself folded in the Vue `useAnimationPlayback.test.ts` coverage). No timers,
 * no reactivity — only the pure step/clamp/state-mapping logic is exercised.
 */

import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	advanceStep,
	buildClickGroups,
	buildPresentationClickGroups,
	clampStep,
	durationOf,
	pendingElementStyles,
	revealedElementStyles,
} from './animation-playback';

function a(elementId: string, overrides: Partial<PptxElementAnimation> = {}): PptxElementAnimation {
	return { elementId, ...overrides };
}

const animations: PptxElementAnimation[] = [
	a('t1', { entrance: 'fadeIn', trigger: 'onClick', durationMs: 500 }),
	a('t2', { entrance: 'flyIn', trigger: 'onClick', durationMs: 500 }),
	a('t3', { entrance: 'zoomIn', trigger: 'afterPrevious', durationMs: 300 }),
];

describe('buildClickGroups', () => {
	it('starts the first group implicitly and splits on onClick', () => {
		const groups = buildClickGroups([
			a('t1', { entrance: 'fadeIn', trigger: 'onClick' }),
			a('t2', { entrance: 'fadeIn', trigger: 'withPrevious' }),
			a('t3', { entrance: 'flyIn', trigger: 'onClick' }),
		]);
		expect(groups).toHaveLength(2);
		expect(groups[0].animations.map((x) => x.elementId)).toStrictEqual(['t1', 't2']);
		expect(groups[1].animations.map((x) => x.elementId)).toStrictEqual(['t3']);
	});

	it('folds afterPrevious into the current group', () => {
		const groups = buildClickGroups([
			a('t1', { entrance: 'fadeIn', trigger: 'onClick' }),
			a('t2', { entrance: 'fadeIn', trigger: 'afterPrevious' }),
		]);
		expect(groups).toHaveLength(1);
		expect(groups[0].animations).toHaveLength(2);
	});

	it('starts a new group on onShapeClick and onHover', () => {
		const groups = buildClickGroups([
			a('t1', { entrance: 'fadeIn', trigger: 'onClick' }),
			a('t2', { entrance: 'flyIn', trigger: 'onShapeClick' }),
			a('t3', { entrance: 'zoomIn', trigger: 'onHover' }),
		]);
		expect(groups).toHaveLength(3);
	});

	it('returns an empty list for no animations', () => {
		expect(buildClickGroups([])).toStrictEqual([]);
	});
});

describe('buildPresentationClickGroups', () => {
	it('suppresses every slide build when the show disables animations', () => {
		expect(
			buildPresentationClickGroups([a('a', { entrance: 'fadeIn', trigger: 'onClick' })], false),
		).toStrictEqual([]);
	});

	it('preserves slide builds when the setting is true or omitted', () => {
		const slideAnimations = [a('a', { entrance: 'fadeIn', trigger: 'onClick' })];
		expect(buildPresentationClickGroups(slideAnimations, true)).toHaveLength(1);
		expect(buildPresentationClickGroups(slideAnimations, undefined)).toHaveLength(1);
	});
});

describe('clampStep / advanceStep', () => {
	it('clamps into [0, count]', () => {
		expect(clampStep(-5, 3)).toBe(0);
		expect(clampStep(1, 3)).toBe(1);
		expect(clampStep(99, 3)).toBe(3);
	});

	it('advances by one, clamped to count', () => {
		expect(advanceStep(0, 2)).toBe(1);
		expect(advanceStep(1, 2)).toBe(2);
		expect(advanceStep(2, 2)).toBe(2);
	});
});

describe('durationOf', () => {
	it('parses an ms animation-duration', () => {
		expect(durationOf({ 'animation-duration': '500ms' })).toBe(500);
		expect(durationOf({ 'animation-duration': '12.5ms' })).toBe(12.5);
	});

	it('returns 0 for missing or unparseable durations', () => {
		expect(durationOf({})).toBe(0);
		expect(durationOf({ 'animation-duration': '1s' })).toBe(0);
	});
});

describe('revealedElementStyles', () => {
	const groups = buildClickGroups(animations);

	it('reveals nothing before the first advance', () => {
		expect(groups).toHaveLength(2);
		expect(revealedElementStyles(groups, 0).size).toBe(0);
	});

	it('reveals one click group per step', () => {
		const afterFirst = revealedElementStyles(groups, 1);
		expect(afterFirst.has('t1')).toBeTruthy();
		expect(afterFirst.has('t2')).toBeFalsy();
		expect(afterFirst.get('t1')!['animation-name']).toBe('pptx-vue-fadeIn');

		const afterSecond = revealedElementStyles(groups, 2);
		expect(afterSecond.has('t2')).toBeTruthy();
		expect(afterSecond.has('t3')).toBeTruthy();
	});

	it('chains afterPrevious delay by the previous duration', () => {
		const styles = revealedElementStyles(groups, 2);
		expect(styles.get('t3')!['animation-delay']).toBe('500ms');
	});

	it('clamps an over-large step to the group count', () => {
		const full = revealedElementStyles(groups, 99);
		expect(full.has('t1')).toBeTruthy();
		expect(full.has('t2')).toBeTruthy();
		expect(full.has('t3')).toBeTruthy();
	});
});

describe('pendingElementStyles', () => {
	const groups = buildClickGroups(animations);

	it('hides pending entrances and stops hiding once revealed', () => {
		expect(pendingElementStyles(groups, 0).get('t1')).toStrictEqual({ opacity: '0' });

		const afterFirst = pendingElementStyles(groups, 1);
		expect(afterFirst.has('t1')).toBeFalsy();
		expect(afterFirst.get('t2')).toStrictEqual({ opacity: '0' });
	});

	it('hides nothing once every group is revealed', () => {
		expect(pendingElementStyles(groups, 2).size).toBe(0);
	});
});
