import type { PptxSection, PptxSlide } from 'pptx-viewer-core';
import { describe, it, expect } from 'vitest';

import {
	addSection,
	deleteSection,
	generateSectionId,
	groupSlidesBySection,
	moveSectionDown,
	moveSectionUp,
	moveSlidesToSection,
	renameSection,
	resolveSlideId,
} from './section-operations';

describe('groupSlidesBySection', () => {
	it('uses declared section order and appends ungrouped slides', () => {
		const sections: PptxSection[] = [
			{ id: '{A}', name: 'A', slideIds: ['1'] },
			{ id: '{B}', name: 'B', slideIds: ['2'] },
		];
		const slides = [slide(1, '{B}'), slide(2), slide(3, '{A}')];

		const groups = groupSlidesBySection(sections, slides);

		expect(groups.map((group) => group.section?.id)).toStrictEqual(['{A}', '{B}', undefined]);
		expect(groups.map((group) => group.slideIndexes)).toStrictEqual([[2], [0], [1]]);
	});

	it('omits empty sections and treats unknown section ids as ungrouped', () => {
		const sections: PptxSection[] = [{ id: '{A}', name: 'A', slideIds: [] }];
		const slides = [slide(1, '{UNKNOWN}')];

		expect(groupSlidesBySection(sections, slides)).toStrictEqual([
			{ section: undefined, slides, slideIndexes: [0] },
		]);
	});

	it('returns one ungrouped group when no sections are declared', () => {
		const slides = [slide(1), slide(2)];
		expect(groupSlidesBySection([], slides)).toStrictEqual([
			{ section: undefined, slides, slideIndexes: [0, 1] },
		]);
	});
});

function slide(n: number, sectionId?: string, sectionName?: string): PptxSlide {
	return {
		id: `slide-${n}`,
		rId: `rId${n}`,
		slideNumber: n,
		elements: [],
		...(sectionId !== undefined ? { sectionId } : {}),
		...(sectionName !== undefined ? { sectionName } : {}),
	};
}

describe('generateSectionId', () => {
	it('produces a brace-wrapped guid-like id', () => {
		expect(generateSectionId()).toMatch(
			/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/u,
		);
	});

	it('produces distinct ids across calls', () => {
		const ids = new Set([
			generateSectionId(),
			generateSectionId(),
			generateSectionId(),
			generateSectionId(),
		]);
		expect(ids.size).toBeGreaterThan(1);
	});
});

describe('resolveSlideId', () => {
	it('prefers the raw p:sld id', () => {
		const s = { ...slide(2), rawXml: { 'p:sld': { '@_id': '256' } } } as PptxSlide;
		expect(resolveSlideId(s, 0)).toBe('256');
	});

	it('falls back to slideNumber then 1-based index', () => {
		expect(resolveSlideId(slide(7), 0)).toBe('7');
		expect(resolveSlideId(undefined, 3)).toBe('4');
	});
});

describe('addSection', () => {
	it('claims the contiguous run and inserts a new section', () => {
		const slides = [slide(1), slide(2), slide(3)];
		const result = addSection([], slides, 'Intro', 1, () => '{NEW}');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0]).toMatchObject({ id: '{NEW}', name: 'Intro' });
		// slides 2 and 3 (indexes 1,2) share the same (undefined) section -> claimed.
		expect(result.slides[0].sectionId).toBeUndefined();
		expect(result.slides[1].sectionId).toBe('{NEW}');
		expect(result.slides[2].sectionId).toBe('{NEW}');
		expect(result.sections[0].slideIds).toStrictEqual(['2', '3']);
	});

	it('does not mutate the inputs', () => {
		const sections: PptxSection[] = [];
		const slides = [slide(1)];
		addSection(sections, slides, 'X', 0, () => '{A}');
		expect(sections).toHaveLength(0);
		expect(slides[0].sectionId).toBeUndefined();
	});
});

describe('renameSection', () => {
	it('renames the section and propagates to its slides', () => {
		const sections: PptxSection[] = [{ id: '{A}', name: 'Old', slideIds: ['1'] }];
		const slides = [slide(1, '{A}', 'Old'), slide(2)];
		const result = renameSection(sections, slides, '{A}', 'New');
		expect(result.sections[0].name).toBe('New');
		expect(result.slides[0].sectionName).toBe('New');
		expect(result.slides[1].sectionName).toBeUndefined();
	});
});

describe('deleteSection', () => {
	it('merges a deleted section into the previous one', () => {
		const sections: PptxSection[] = [
			{ id: '{A}', name: 'A', slideIds: ['1'] },
			{ id: '{B}', name: 'B', slideIds: ['2'] },
		];
		const slides = [slide(1, '{A}', 'A'), slide(2, '{B}', 'B')];
		const result = deleteSection(sections, slides, '{B}');
		expect(result.sections).toHaveLength(1);
		expect(result.sections[0].slideIds).toStrictEqual(['1', '2']);
		expect(result.slides[1].sectionId).toBe('{A}');
		expect(result.slides[1].sectionName).toBe('A');
	});

	it('clears the section on slides when deleting the first section', () => {
		const sections: PptxSection[] = [{ id: '{A}', name: 'A', slideIds: ['1'] }];
		const slides = [slide(1, '{A}', 'A')];
		const result = deleteSection(sections, slides, '{A}');
		expect(result.sections).toHaveLength(0);
		expect(result.slides[0].sectionId).toBeUndefined();
		expect(result.slides[0].sectionName).toBeUndefined();
	});

	it('returns inputs unchanged for an unknown section', () => {
		const sections: PptxSection[] = [{ id: '{A}', name: 'A', slideIds: [] }];
		const slides = [slide(1)];
		const result = deleteSection(sections, slides, '{Z}');
		expect(result.sections).toBe(sections);
		expect(result.slides).toBe(slides);
	});
});

describe('moveSectionUp / moveSectionDown', () => {
	const sections: PptxSection[] = [
		{ id: '{A}', name: 'A', slideIds: [] },
		{ id: '{B}', name: 'B', slideIds: [] },
		{ id: '{C}', name: 'C', slideIds: [] },
	];

	it('moves a section up', () => {
		expect(moveSectionUp(sections, '{B}').map((s) => s.id)).toStrictEqual(['{B}', '{A}', '{C}']);
	});

	it('moves a section down', () => {
		expect(moveSectionDown(sections, '{B}').map((s) => s.id)).toStrictEqual(['{A}', '{C}', '{B}']);
	});

	it('is a no-op at the boundaries', () => {
		expect(moveSectionUp(sections, '{A}')).toBe(sections);
		expect(moveSectionDown(sections, '{C}')).toBe(sections);
	});
});

describe('moveSlidesToSection', () => {
	it('reassigns slides and updates section slideIds', () => {
		const sections: PptxSection[] = [
			{ id: '{A}', name: 'A', slideIds: ['1'] },
			{ id: '{B}', name: 'B', slideIds: ['2'] },
		];
		const slides = [slide(1, '{A}', 'A'), slide(2, '{B}', 'B')];
		const result = moveSlidesToSection(sections, slides, [0], '{B}');
		expect(result.slides[0].sectionId).toBe('{B}');
		expect(result.sections[1].slideIds).toContain('1');
		expect(result.sections[0].slideIds).not.toContain('1');
	});

	it('returns inputs unchanged for an unknown target', () => {
		const sections: PptxSection[] = [{ id: '{A}', name: 'A', slideIds: [] }];
		const slides = [slide(1)];
		const result = moveSlidesToSection(sections, slides, [0], '{Z}');
		expect(result.sections).toBe(sections);
		expect(result.slides).toBe(slides);
	});
});
