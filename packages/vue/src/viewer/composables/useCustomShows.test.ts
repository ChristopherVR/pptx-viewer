// oxlint-disable react-hooks/rules-of-hooks
import type { PptxCustomShow, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useCustomShows } from './useCustomShows';

function makeSlide(id: string, rId: string): PptxSlide {
	return { id, rId, slideNumber: 1, elements: [] };
}

function makeShow(
	overrides: Partial<PptxCustomShow> & { id: string; name: string },
): PptxCustomShow {
	return { slideRIds: [], ...overrides };
}

function setup(initialShows: PptxCustomShow[], initialSlides: PptxSlide[], active = 0) {
	const customShows = ref<PptxCustomShow[]>(initialShows);
	const slides = ref<PptxSlide[]>(initialSlides);
	const activeSlideIndex = ref(active);
	const pushHistory = vi.fn();
	const ops = useCustomShows({ customShows, slides, activeSlideIndex, pushHistory });
	return { customShows, slides, activeSlideIndex, pushHistory, ops };
}

describe('useCustomShows', () => {
	describe('createCustomShow', () => {
		it('appends a show seeded with the active slide and snapshots history', () => {
			const { customShows, pushHistory, ops } = setup(
				[],
				[makeSlide('s1', 'rId2'), makeSlide('s2', 'rId5')],
				1,
			);
			const id = ops.createCustomShow('Exec Summary');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(customShows.value).toHaveLength(1);
			expect(customShows.value[0].id).toBe(id);
			expect(customShows.value[0].name).toBe('Exec Summary');
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId5']);
		});

		it('falls back to a default name when blank', () => {
			const { customShows, ops } = setup([], [makeSlide('s1', 'rId2')]);
			ops.createCustomShow('   ');
			expect(customShows.value[0].name).toBe('Custom Show 1');
		});

		it('creates an empty show when seeding is disabled', () => {
			const { customShows, ops } = setup([], [makeSlide('s1', 'rId2')]);
			ops.createCustomShow('Empty', false);
			expect(customShows.value[0].slideRIds).toStrictEqual([]);
		});
	});

	describe('renameCustomShow', () => {
		it('renames the matching show', () => {
			const { customShows, pushHistory, ops } = setup([makeShow({ id: 'a', name: 'Old' })], []);
			ops.renameCustomShow('a', 'New');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(customShows.value[0].name).toBe('New');
		});

		it('is a no-op for a blank name', () => {
			const { customShows, pushHistory, ops } = setup([makeShow({ id: 'a', name: 'Old' })], []);
			ops.renameCustomShow('a', '  ');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(customShows.value[0].name).toBe('Old');
		});

		it('is a no-op for a missing show', () => {
			const { pushHistory, ops } = setup([makeShow({ id: 'a', name: 'Old' })], []);
			ops.renameCustomShow('missing', 'New');
			expect(pushHistory).not.toHaveBeenCalled();
		});
	});

	describe('deleteCustomShow', () => {
		it('removes the matching show and snapshots history', () => {
			const { customShows, pushHistory, ops } = setup(
				[makeShow({ id: 'a', name: 'A' }), makeShow({ id: 'b', name: 'B' })],
				[],
			);
			ops.deleteCustomShow('a');
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(customShows.value.map((s) => s.id)).toStrictEqual(['b']);
		});

		it('is a no-op for a missing show', () => {
			const { customShows, pushHistory, ops } = setup([makeShow({ id: 'a', name: 'A' })], []);
			ops.deleteCustomShow('missing');
			expect(pushHistory).not.toHaveBeenCalled();
			expect(customShows.value).toHaveLength(1);
		});
	});

	describe('toggleSlideInShow', () => {
		it('adds a slide rId when absent', () => {
			const { customShows, ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId2'] })],
				[],
			);
			ops.toggleSlideInShow('a', 'rId5');
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId2', 'rId5']);
		});

		it('removes a slide rId when present', () => {
			const { customShows, ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId2', 'rId5'] })],
				[],
			);
			ops.toggleSlideInShow('a', 'rId2');
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId5']);
		});

		it('is a no-op for missing arguments', () => {
			const { pushHistory, ops } = setup([makeShow({ id: 'a', name: 'A' })], []);
			ops.toggleSlideInShow('', 'rId2');
			ops.toggleSlideInShow('a', '');
			expect(pushHistory).not.toHaveBeenCalled();
		});
	});

	describe('setShowSlides', () => {
		it('replaces a show ordered list wholesale', () => {
			const { customShows, ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId2'] })],
				[],
			);
			ops.setShowSlides('a', ['rId9', 'rId3']);
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId9', 'rId3']);
		});
	});

	describe('moveSlideInShow', () => {
		it('reorders a slide within the show order', () => {
			const { customShows, pushHistory, ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId1', 'rId2', 'rId3'] })],
				[],
			);
			ops.moveSlideInShow('a', 0, 2);
			expect(pushHistory).toHaveBeenCalledOnce();
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId2', 'rId3', 'rId1']);
		});

		it('is a no-op for an out-of-range or identity move', () => {
			const { customShows, pushHistory, ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId1', 'rId2'] })],
				[],
			);
			ops.moveSlideInShow('a', 1, 1);
			ops.moveSlideInShow('a', 0, 9);
			expect(pushHistory).not.toHaveBeenCalled();
			expect(customShows.value[0].slideRIds).toStrictEqual(['rId1', 'rId2']);
		});
	});

	describe('isActiveSlideInShow / activeSlideRId', () => {
		it('reports the active slide rId and membership', () => {
			const { ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId5'] })],
				[makeSlide('s1', 'rId2'), makeSlide('s2', 'rId5')],
				1,
			);
			expect(ops.activeSlideRId.value).toBe('rId5');
			expect(ops.isActiveSlideInShow('a')).toBeTruthy();
		});

		it('reports false when the active slide has no rId', () => {
			const { ops } = setup(
				[makeShow({ id: 'a', name: 'A', slideRIds: ['rId5'] })],
				[makeSlide('s1', '')],
			);
			expect(ops.activeSlideRId.value).toBeUndefined();
			expect(ops.isActiveSlideInShow('a')).toBeFalsy();
		});
	});
});
