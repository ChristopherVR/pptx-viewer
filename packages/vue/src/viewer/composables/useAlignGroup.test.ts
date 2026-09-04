// oxlint-disable react-hooks/rules-of-hooks
/**
 * G10 (OpenXML parity audit, D3): `a:spLocks`/`a:grpSpLocks`/@noGrouping was
 * parsed but never consulted by the actual group/ungroup command, only by
 * the ribbon's separate `canGroupSelection`/`canUngroupSelection` gate (which
 * only takes a selection count, not the elements, and cannot see locks). A
 * locked shape could still be grouped, and a locked group could still be
 * ungrouped, from this composable's `onGroup`/`onUngroup`.
 */
import type { PptxElement, PptxSlide, GroupPptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref, computed } from 'vue';

import { useAlignGroup } from './useAlignGroup';

function shape(id: string, overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeType: 'rect',
		...overrides,
	} as unknown as PptxElement;
}

function setup(elements: PptxElement[]) {
	const slides = ref<PptxSlide[]>([{ id: 's1', elements } as unknown as PptxSlide]);
	const selectedElementIds = ref<string[]>(elements.map((el) => el.id));
	const activeSlideIndex = ref(0);
	const selectedElements = computed(() =>
		selectedElementIds.value
			.map((id) => slides.value[0]?.elements.find((el) => el.id === id))
			.filter((el): el is PptxElement => Boolean(el)),
	);
	let pushed = 0;
	const api = useAlignGroup({
		selectedElements,
		selectedElementIds,
		activeSlideIndex,
		slides,
		pushHistory: () => pushed++,
	});
	return { api, slides, selectedElementIds, pushed: () => pushed };
}

describe('onGroup with a:spLocks/@noGrouping', () => {
	it('rejects the whole grouping attempt when any selected shape is locked', () => {
		const locked = shape('a', { locks: { noGrouping: true } });
		const free = shape('b', { x: 200 });
		const { api, slides, pushed } = setup([locked, free]);
		expect(api.canGroup.value).toBeFalsy();
		api.onGroup();
		expect(slides.value[0]?.elements.map((el) => el.type)).toStrictEqual(['shape', 'shape']);
		expect(pushed()).toBe(0);
	});

	it('groups an unlocked selection normally', () => {
		const a = shape('a');
		const b = shape('b', { x: 200 });
		const { api, slides, pushed } = setup([a, b]);
		expect(api.canGroup.value).toBeTruthy();
		api.onGroup();
		expect(slides.value[0]?.elements.some((el) => el.type === 'group')).toBeTruthy();
		expect(pushed()).toBe(1);
	});
});

describe('onUngroup with a:grpSpLocks/@noGrouping', () => {
	it('refuses to ungroup a group whose own noGrouping lock is set', () => {
		const group = shape('g', {
			type: 'group',
			children: [shape('c1'), shape('c2', { x: 200 })],
			locks: { noGrouping: true },
		}) as GroupPptxElement;
		const { api, slides, selectedElementIds, pushed } = setup([group]);
		selectedElementIds.value = ['g'];
		expect(api.canUngroup.value).toBeFalsy();
		api.onUngroup();
		expect(slides.value[0]?.elements).toStrictEqual([group]);
		expect(pushed()).toBe(0);
	});

	it('ungroups an unlocked group normally', () => {
		const group = shape('g', {
			type: 'group',
			children: [shape('c1'), shape('c2', { x: 200 })],
		}) as GroupPptxElement;
		const { api, slides, selectedElementIds, pushed } = setup([group]);
		selectedElementIds.value = ['g'];
		expect(api.canUngroup.value).toBeTruthy();
		api.onUngroup();
		expect(slides.value[0]?.elements.some((el) => el.type === 'group')).toBeFalsy();
		expect(pushed()).toBe(1);
	});
});
