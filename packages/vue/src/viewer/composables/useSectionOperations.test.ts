// oxlint-disable react-hooks/rules-of-hooks
import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useSectionOperations } from './useSectionOperations';

function makeSlide(overrides: Partial<PptxSlide> & { id: string }): PptxSlide {
	return { rId: '', slideNumber: 1, elements: [], ...overrides } as PptxSlide;
}

function makeSection(overrides: Partial<PptxSection> & { id: string; name: string }): PptxSection {
	return { slideIds: [], ...overrides };
}

function setup(initialSections: PptxSection[], initialSlides: PptxSlide[], active = 0) {
	const sections = ref<PptxSection[]>(initialSections);
	const slides = ref<PptxSlide[]>(initialSlides);
	const activeSlideIndex = ref(active);
	const pushHistory = vi.fn();
	const ops = useSectionOperations({ sections, slides, activeSlideIndex, pushHistory });
	return { sections, slides, activeSlideIndex, pushHistory, ops };
}

describe('useSectionOperations', () => {
	describe('renameSection', () => {
		it('renames the matching section and leaves others untouched', () => {
			const { sections, pushHistory, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'Introduction' }),
					makeSection({ id: 'sec2', name: 'Body' }),
				],
				[],
			);
			ops.renameSection('sec1', 'New Intro');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(sections.value.map((s) => s.name)).toStrictEqual(['New Intro', 'Body']);
		});

		it('propagates the new name to slides in that section', () => {
			const { slides, ops } = setup(
				[makeSection({ id: 'sec1', name: 'Old' })],
				[
					makeSlide({ id: 's1', sectionId: 'sec1', sectionName: 'Old' }),
					makeSlide({ id: 's2', sectionId: 'sec2', sectionName: 'Other' }),
				],
			);
			ops.renameSection('sec1', 'New Name');
			expect(slides.value[0].sectionName).toBe('New Name');
			expect(slides.value[1].sectionName).toBe('Other');
		});
	});

	describe('deleteSection', () => {
		it("merges the deleted section's slideIds into the previous section", () => {
			const { sections, pushHistory, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'Intro', slideIds: ['1', '2'] }),
					makeSection({ id: 'sec2', name: 'Body', slideIds: ['3', '4'] }),
				],
				[],
			);
			ops.deleteSection('sec2');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(sections.value).toHaveLength(1);
			expect(sections.value[0].slideIds).toStrictEqual(['1', '2', '3', '4']);
		});

		it('removes the first section without merging when no previous section', () => {
			const { sections, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'Intro', slideIds: ['1'] }),
					makeSection({ id: 'sec2', name: 'Body', slideIds: ['2'] }),
				],
				[],
			);
			ops.deleteSection('sec1');
			expect(sections.value).toHaveLength(1);
			expect(sections.value[0].id).toBe('sec2');
			expect(sections.value[0].slideIds).toStrictEqual(['2']);
		});

		it('is a no-op (and does not snapshot) when the section is not found', () => {
			const before = [makeSection({ id: 'sec1', name: 'Intro' })];
			const { sections, pushHistory, ops } = setup(before, []);
			const ref0 = sections.value;
			ops.deleteSection('unknown');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});

		it('handles deleting a middle section', () => {
			const { sections, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'A', slideIds: ['1'] }),
					makeSection({ id: 'sec2', name: 'B', slideIds: ['2', '3'] }),
					makeSection({ id: 'sec3', name: 'C', slideIds: ['4'] }),
				],
				[],
			);
			ops.deleteSection('sec2');
			expect(sections.value).toHaveLength(2);
			expect(sections.value[0].slideIds).toStrictEqual(['1', '2', '3']);
			expect(sections.value[1].slideIds).toStrictEqual(['4']);
		});

		it('moves slides to the previous section', () => {
			const { slides, ops } = setup(
				[makeSection({ id: 'sec1', name: 'Intro' }), makeSection({ id: 'sec2', name: 'Body' })],
				[makeSlide({ id: 's1', sectionId: 'sec2', sectionName: 'Body' })],
			);
			ops.deleteSection('sec2');
			expect(slides.value[0].sectionId).toBe('sec1');
			expect(slides.value[0].sectionName).toBe('Intro');
		});

		it('clears sectionId on slides when no previous section exists', () => {
			const { slides, ops } = setup(
				[makeSection({ id: 'sec1', name: 'Intro' }), makeSection({ id: 'sec2', name: 'Body' })],
				[makeSlide({ id: 's1', sectionId: 'sec1', sectionName: 'Intro' })],
			);
			ops.deleteSection('sec1');
			expect(slides.value[0].sectionId).toBeUndefined();
			expect(slides.value[0].sectionName).toBeUndefined();
		});

		it('does not modify slides from other sections', () => {
			const { slides, ops } = setup(
				[makeSection({ id: 'sec1', name: 'Intro' }), makeSection({ id: 'sec2', name: 'Body' })],
				[makeSlide({ id: 's1', sectionId: 'sec1' }), makeSlide({ id: 's2', sectionId: 'sec2' })],
			);
			ops.deleteSection('sec2');
			expect(slides.value[0].sectionId).toBe('sec1');
		});
	});

	describe('moveSectionUp', () => {
		const make = () =>
			setup(
				[
					makeSection({ id: 'sec1', name: 'A' }),
					makeSection({ id: 'sec2', name: 'B' }),
					makeSection({ id: 'sec3', name: 'C' }),
				],
				[],
			);

		it('swaps a section with the one above it', () => {
			const { sections, pushHistory, ops } = make();
			ops.moveSectionUp('sec2');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(sections.value.map((s) => s.id)).toStrictEqual(['sec2', 'sec1', 'sec3']);
		});

		it('is a no-op when already first', () => {
			const { sections, pushHistory, ops } = make();
			const ref0 = sections.value;
			ops.moveSectionUp('sec1');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});

		it('is a no-op when the section is not found', () => {
			const { sections, pushHistory, ops } = make();
			const ref0 = sections.value;
			ops.moveSectionUp('unknown');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});

		it('moves the last section up', () => {
			const { sections, ops } = make();
			ops.moveSectionUp('sec3');
			expect(sections.value.map((s) => s.id)).toStrictEqual(['sec1', 'sec3', 'sec2']);
		});
	});

	describe('moveSectionDown', () => {
		const make = () =>
			setup(
				[
					makeSection({ id: 'sec1', name: 'A' }),
					makeSection({ id: 'sec2', name: 'B' }),
					makeSection({ id: 'sec3', name: 'C' }),
				],
				[],
			);

		it('swaps a section with the one below it', () => {
			const { sections, ops } = make();
			ops.moveSectionDown('sec2');
			expect(sections.value.map((s) => s.id)).toStrictEqual(['sec1', 'sec3', 'sec2']);
		});

		it('is a no-op when already last', () => {
			const { sections, pushHistory, ops } = make();
			const ref0 = sections.value;
			ops.moveSectionDown('sec3');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});

		it('is a no-op when the section is not found', () => {
			const { sections, pushHistory, ops } = make();
			const ref0 = sections.value;
			ops.moveSectionDown('unknown');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});

		it('moves the first section down', () => {
			const { sections, ops } = make();
			ops.moveSectionDown('sec1');
			expect(sections.value.map((s) => s.id)).toStrictEqual(['sec2', 'sec1', 'sec3']);
		});
	});

	describe('moveSlidesToSection', () => {
		it('updates sectionId and sectionName for the target slides', () => {
			const { slides, pushHistory, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'A', slideIds: ['1', '2'] }),
					makeSection({ id: 'sec2', name: 'Other', slideIds: ['3'] }),
					makeSection({ id: 'sec3', name: 'New Section', slideIds: [] }),
				],
				[
					makeSlide({ id: 's1', slideNumber: 1, sectionId: 'sec1', sectionName: 'A' }),
					makeSlide({ id: 's2', slideNumber: 2, sectionId: 'sec1', sectionName: 'A' }),
					makeSlide({ id: 's3', slideNumber: 3, sectionId: 'sec2', sectionName: 'Other' }),
				],
			);
			ops.moveSlidesToSection([0, 1], 'sec3');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(slides.value[0].sectionId).toBe('sec3');
			expect(slides.value[0].sectionName).toBe('New Section');
			expect(slides.value[1].sectionId).toBe('sec3');
			expect(slides.value[2].sectionId).toBe('sec2');
		});

		it('adds slide ids to the target section and removes them from others', () => {
			const { sections, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'A', slideIds: ['1', '2'] }),
					makeSection({ id: 'sec2', name: 'B', slideIds: ['3'] }),
				],
				[
					makeSlide({ id: 's1', slideNumber: 1, sectionId: 'sec1' }),
					makeSlide({ id: 's2', slideNumber: 2, sectionId: 'sec1' }),
				],
			);
			// slide index 1 → slideNumber 2 → id "2"
			ops.moveSlidesToSection([1], 'sec2');
			expect(sections.value[0].slideIds).toStrictEqual(['1']);
			expect(sections.value[1].slideIds).toStrictEqual(['3', '2']);
		});

		it('is a no-op when the target section is missing', () => {
			const before = [makeSection({ id: 'sec1', name: 'A' })];
			const { sections, pushHistory, ops } = setup(before, [
				makeSlide({ id: 's1', slideNumber: 1 }),
			]);
			const ref0 = sections.value;
			ops.moveSlidesToSection([0], 'missing');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(sections.value).toBe(ref0);
		});
	});

	describe('addSection', () => {
		it('inserts a new section claiming the contiguous run of same-section slides', () => {
			const { sections, slides, ops } = setup(
				[],
				[
					makeSlide({ id: 's1', slideNumber: 1 }),
					makeSlide({ id: 's2', slideNumber: 2 }),
					makeSlide({ id: 's3', slideNumber: 3 }),
				],
			);
			ops.addSection('Part 2', 1);
			expect(sections.value).toHaveLength(1);
			expect(sections.value[0].name).toBe('Part 2');
			// slides 2 and 3 share the same (undefined) section, so both are claimed.
			expect(sections.value[0].slideIds).toStrictEqual(['2', '3']);
			expect(slides.value[1].sectionName).toBe('Part 2');
			expect(slides.value[2].sectionName).toBe('Part 2');
			expect(slides.value[0].sectionId).toBeUndefined();
		});

		it('inserts the new section after the current slide section', () => {
			const { sections, ops } = setup(
				[makeSection({ id: 'secA', name: 'A', slideIds: ['1', '2'] })],
				[
					makeSlide({ id: 's1', slideNumber: 1, sectionId: 'secA', sectionName: 'A' }),
					makeSlide({ id: 's2', slideNumber: 2, sectionId: 'secA', sectionName: 'A' }),
				],
			);
			ops.addSection('B', 1);
			expect(sections.value.map((s) => s.name)).toStrictEqual(['A', 'B']);
			// slide 2 moves to the new section, leaving "1" in A and "2" in B.
			expect(sections.value[0].slideIds).toStrictEqual(['1']);
			expect(sections.value[1].slideIds).toStrictEqual(['2']);
		});

		it('snapshots history before mutating', () => {
			const { pushHistory, ops } = setup([], [makeSlide({ id: 's1', slideNumber: 1 })]);
			ops.addSection('X', 0);
			expect(pushHistory).toHaveBeenCalledOnce();
		});
	});

	describe('toggleSectionCollapse', () => {
		it('flips the collapsed flag on the matching section', () => {
			const { sections, ops } = setup(
				[
					makeSection({ id: 'sec1', name: 'A' }),
					makeSection({ id: 'sec2', name: 'B', collapsed: true }),
				],
				[],
			);
			ops.toggleSectionCollapse('sec1');
			expect(sections.value[0].collapsed).toBeTruthy();
			ops.toggleSectionCollapse('sec2');
			expect(sections.value[1].collapsed).toBeFalsy();
		});
	});

	describe('slidesBySection', () => {
		it('groups slides under their section in deck order', () => {
			const { ops } = setup(
				[makeSection({ id: 'sec1', name: 'A' }), makeSection({ id: 'sec2', name: 'B' })],
				[
					makeSlide({ id: 's1', slideNumber: 1, sectionId: 'sec1' }),
					makeSlide({ id: 's2', slideNumber: 2, sectionId: 'sec1' }),
					makeSlide({ id: 's3', slideNumber: 3, sectionId: 'sec2' }),
				],
			);
			const groups = ops.slidesBySection.value;
			expect(groups).toHaveLength(2);
			expect(groups[0].section?.id).toBe('sec1');
			expect(groups[0].slideIndexes).toStrictEqual([0, 1]);
			expect(groups[1].section?.id).toBe('sec2');
			expect(groups[1].slideIndexes).toStrictEqual([2]);
		});

		it('produces a leading no-section group for unsectioned slides', () => {
			const { ops } = setup(
				[makeSection({ id: 'sec1', name: 'A' })],
				[
					makeSlide({ id: 's1', slideNumber: 1 }),
					makeSlide({ id: 's2', slideNumber: 2, sectionId: 'sec1' }),
				],
			);
			const groups = ops.slidesBySection.value;
			expect(groups).toHaveLength(2);
			expect(groups[0].section).toBeUndefined();
			expect(groups[0].slideIndexes).toStrictEqual([0]);
			expect(groups[1].section?.id).toBe('sec1');
		});

		it('reacts to slide-list changes', () => {
			const { slides, ops } = setup([], [makeSlide({ id: 's1', slideNumber: 1 })]);
			expect(ops.slidesBySection.value).toHaveLength(1);
			slides.value = [...slides.value, makeSlide({ id: 's2', slideNumber: 2 })];
			expect(ops.slidesBySection.value[0].slideIndexes).toStrictEqual([0, 1]);
		});
	});
});
