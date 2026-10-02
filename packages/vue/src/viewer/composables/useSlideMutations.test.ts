// oxlint-disable react-hooks/rules-of-hooks
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { motionPathPresetById } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useSlideMutations } from './useSlideMutations';

const SHAPE = { type: 'shape', id: 'sp1', x: 0, y: 0, width: 100, height: 40 } as PptxElement;

function setup() {
	const slides = ref<PptxSlide[]>([{ id: 's1', elements: [SHAPE] } as unknown as PptxSlide]);
	const activeSlideIndex = ref(0);
	const pushHistory = vi.fn();
	const mutations = useSlideMutations({
		slides,
		activeSlideIndex,
		activeSlide: computed(() => slides.value[activeSlideIndex.value]),
		pushHistory,
		selectedElements: computed(() => [SHAPE]),
	});
	return { slides, mutations, pushHistory };
}

/**
 * The `motionPath` bucket carries a catalogue id whose path GEOMETRY is what
 * gets stored, so it must not be cast into the preset field the other three
 * buckets write. That mix-up is invisible until save time, where it emits a
 * preset name no renderer knows.
 */
describe('useSlideMutations onAddAnimation', () => {
	it('stores a motion path as geometry, not as a preset name', () => {
		const { slides, mutations, pushHistory } = setup();

		mutations.onAddAnimation('lineRight', 'motionPath');

		const animation = slides.value[0].animations?.[0];
		expect(animation).toMatchObject({
			elementId: 'sp1',
			motionPath: motionPathPresetById('lineRight')?.path,
			motionPathEditMode: 'relative',
		});
		expect(animation?.entrance).toBeUndefined();
		expect(pushHistory).toHaveBeenCalledOnce();
	});

	it('still routes the three preset buckets to their own fields', () => {
		const { slides, mutations } = setup();

		mutations.onAddAnimation('fadeIn', 'entrance');

		expect(slides.value[0].animations?.[0]).toMatchObject({ elementId: 'sp1', entrance: 'fadeIn' });
		expect(slides.value[0].animations?.[0].motionPath).toBeUndefined();
	});

	it('keeps a path and a preset on the same timeline entry', () => {
		const { slides, mutations } = setup();

		mutations.onAddAnimation('fadeIn', 'entrance');
		mutations.onAddAnimation('arcUp', 'motionPath');

		expect(slides.value[0].animations).toHaveLength(1);
		expect(slides.value[0].animations?.[0]).toMatchObject({
			entrance: 'fadeIn',
			motionPath: motionPathPresetById('arcUp')?.path,
		});
	});

	it('leaves the list untouched for an unknown catalogue id', () => {
		const { slides, mutations } = setup();

		mutations.onAddAnimation('notAPath', 'motionPath');

		expect(slides.value[0].animations).toStrictEqual([]);
	});
});

describe('useSlideMutations onNotesUpdate', () => {
	it('stores the text with its rich segments so formatting survives', () => {
		const { slides, mutations, pushHistory } = setup();
		const segments = [{ text: 'Bold', style: { bold: true } }];

		mutations.onNotesUpdate('Bold', segments);

		expect(slides.value[0]).toMatchObject({ notes: 'Bold', notesSegments: segments });
		expect(pushHistory).toHaveBeenCalledOnce();
	});

	it('drops stale segments when the notes are cleared or plain', () => {
		const { slides, mutations } = setup();
		mutations.onNotesUpdate('Bold', [{ text: 'Bold', style: { bold: true } }]);

		mutations.onNotesUpdate('', []);

		expect(slides.value[0].notes).toBe('');
		expect(slides.value[0].notesSegments).toBeUndefined();
	});

	it('leaves segments alone for a text-only update', () => {
		const { slides, mutations } = setup();
		mutations.onNotesUpdate('Bold', [{ text: 'Bold', style: { bold: true } }]);

		mutations.onNotesUpdate('Other');

		expect(slides.value[0]).toMatchObject({ notes: 'Other' });
		expect(slides.value[0].notesSegments).toHaveLength(1);
	});
});
