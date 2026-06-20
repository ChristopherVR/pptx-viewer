import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { useVersionHistory } from './useVersionHistory';

function el(id: string, x = 0): PptxElement {
	return {
		type: 'shape',
		id,
		x,
		y: 0,
		width: 100,
		height: 50,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[] = []): PptxSlide {
	return {
		id,
		rId: `rId-${id}`,
		slideNumber: 1,
		elements,
	};
}

describe('useVersionHistory', () => {
	it('starts empty', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const { versions, hasVersions } = useVersionHistory({ slides, pushHistory: vi.fn() });
		expect(versions.value).toHaveLength(0);
		expect(hasVersions.value).toBeFalsy();
	});

	it('captures a labelled, timestamped snapshot of the current slides', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn() });

		const version = history.capture('Checkpoint', 1000);
		expect(history.versions.value).toHaveLength(1);
		expect(version.label).toBe('Checkpoint');
		expect(version.timestamp).toBe(1000);
		expect(version.slideCount).toBe(1);
		expect(history.hasVersions.value).toBeTruthy();
	});

	it('captures a deep clone - later edits do not mutate the stored version', () => {
		const live = el('a', 10);
		const slides = shallowRef<PptxSlide[]>([slide('s1', [live])]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn() });

		const version = history.capture('v1', 1);
		// Mutate the live element after capture.
		slides.value = [slide('s1', [el('a', 999)])];

		expect(version.slides[0].elements[0].x).toBe(10);
	});

	it('restore replaces live slides and pushes history first', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a')])]);
		const pushHistory = vi.fn();
		const history = useVersionHistory({ slides, pushHistory });

		const v1 = history.capture('snapshot', 1);
		slides.value = [slide('s1', [el('a'), el('b')])];

		const ok = history.restore(v1.id);
		expect(ok).toBeTruthy();
		expect(pushHistory).toHaveBeenCalledOnce();
		expect(slides.value[0].elements.map((e) => e.id)).toStrictEqual(['a']);
	});

	it('restore returns false and does not push history for an unknown id', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const pushHistory = vi.fn();
		const history = useVersionHistory({ slides, pushHistory });

		expect(history.restore('nope')).toBeFalsy();
		expect(pushHistory).not.toHaveBeenCalled();
	});

	it('restored slides are independent clones of the stored snapshot', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1', [el('a', 5)])]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn() });

		const v1 = history.capture('v1', 1);
		slides.value = [slide('s1', [el('a', 50)])];
		history.restore(v1.id);

		// Mutating the live restored slide must not corrupt the stored version.
		slides.value[0].elements[0].x = -1;
		expect(v1.slides[0].elements[0].x).toBe(5);
	});

	it('remove drops a version by id', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn() });

		const v1 = history.capture('v1', 1);
		history.capture('v2', 2);
		expect(history.remove(v1.id)).toBeTruthy();
		expect(history.versions.value.map((v) => v.label)).toStrictEqual(['v2']);
		expect(history.remove('missing')).toBeFalsy();
	});

	it('caps the list, dropping the oldest version first', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn(), maxVersions: 2 });

		history.capture('a', 1);
		history.capture('b', 2);
		history.capture('c', 3);

		expect(history.versions.value.map((v) => v.label)).toStrictEqual(['b', 'c']);
	});

	it('clear empties the list', () => {
		const slides = shallowRef<PptxSlide[]>([slide('s1')]);
		const history = useVersionHistory({ slides, pushHistory: vi.fn() });
		history.capture('a', 1);
		history.clear();
		expect(history.versions.value).toHaveLength(0);
		expect(history.hasVersions.value).toBeFalsy();
	});
});
