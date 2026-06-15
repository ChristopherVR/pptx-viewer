// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElementAnimation } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { buildClickGroups, useAnimationPlayback } from './useAnimationPlayback';

function a(elementId: string, overrides: Partial<PptxElementAnimation> = {}): PptxElementAnimation {
	return { elementId, ...overrides };
}

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
});

describe('useAnimationPlayback', () => {
	const animations: PptxElementAnimation[] = [
		a('t1', { entrance: 'fadeIn', trigger: 'onClick', durationMs: 500 }),
		a('t2', { entrance: 'flyIn', trigger: 'onClick', durationMs: 500 }),
		a('t3', { entrance: 'zoomIn', trigger: 'afterPrevious', durationMs: 300 }),
	];

	it('reveals nothing before the first advance', () => {
		const { elementStyles, groupCount, isComplete } = useAnimationPlayback({
			animations: () => animations,
		});
		expect(groupCount.value).toBe(2);
		expect(elementStyles.value.size).toBe(0);
		expect(isComplete.value).toBeFalsy();
	});

	it('advance() reveals the next click group', () => {
		const { elementStyles, advance, isComplete } = useAnimationPlayback({
			animations: () => animations,
		});

		expect(advance()).toBeTruthy();
		// First group: only t1 is revealed.
		expect(elementStyles.value.has('t1')).toBeTruthy();
		expect(elementStyles.value.has('t2')).toBeFalsy();
		expect(elementStyles.value.get('t1')!['animation-name']).toBe('pptx-vue-fadeIn');

		expect(advance()).toBeTruthy();
		// Second group: t2 (and its afterPrevious t3) now revealed.
		expect(elementStyles.value.has('t2')).toBeTruthy();
		expect(elementStyles.value.has('t3')).toBeTruthy();
		expect(isComplete.value).toBeTruthy();

		// No more groups — advance returns false so the host can navigate slides.
		expect(advance()).toBeFalsy();
	});

	it('chains afterPrevious delay by the previous duration', () => {
		const { advance, elementStyles } = useAnimationPlayback({ animations: () => animations });
		advance();
		advance();
		// t3 is afterPrevious of t2 (500ms), so its delay should be 500ms.
		expect(elementStyles.value.get('t3')!['animation-delay']).toBe('500ms');
	});

	it('hides pending entrances and stops hiding once revealed', () => {
		const { advance, pendingStyles } = useAnimationPlayback({ animations: () => animations });
		expect(pendingStyles.value.get('t1')).toStrictEqual({ opacity: '0' });
		advance();
		expect(pendingStyles.value.has('t1')).toBeFalsy();
		expect(pendingStyles.value.get('t2')).toStrictEqual({ opacity: '0' });
	});

	it('play() reveals all groups and reset() clears them', () => {
		const { play, reset, step, groupCount, elementStyles } = useAnimationPlayback({
			animations: () => animations,
		});
		play();
		expect(step.value).toBe(groupCount.value);
		expect(elementStyles.value.size).toBeGreaterThan(0);
		reset();
		expect(step.value).toBe(0);
		expect(elementStyles.value.size).toBe(0);
	});

	it('syncs with an external currentIndex and clamps it', () => {
		const idx = ref(1);
		const { step, elementStyles } = useAnimationPlayback({
			animations: () => animations,
			currentIndex: idx,
		});
		expect(step.value).toBe(1);
		expect(elementStyles.value.has('t1')).toBeTruthy();

		idx.value = 99;
		expect(step.value).toBe(2); // clamped to groupCount
	});

	it('reclamps the step when the animation set shrinks', () => {
		const list = ref<PptxElementAnimation[]>(animations);
		const { step, play } = useAnimationPlayback({ animations: list });
		play();
		expect(step.value).toBe(2);
		list.value = [a('t1', { entrance: 'fadeIn', trigger: 'onClick' })];
		expect(step.value).toBe(1);
	});
});
