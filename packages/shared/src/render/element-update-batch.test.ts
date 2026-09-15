import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	cloneElementUpdates,
	prepareElementUpdateBatch,
	commitElementUpdateBatch,
} from './element-update-batch';

const makeSlides = (): PptxSlide[] =>
	[0, 1].map((index) => ({
		id: `slide-${index}`,
		rId: `rId${index}`,
		slideNumber: index + 1,
		elements: [{ id: 'title', type: 'text', x: 67, y: 40, width: 200, height: 60, text: 'Title' }],
	}));

describe('element update batches', () => {
	it('targets elements by slide and element ID without mutating the input', () => {
		const slides = makeSlides();
		const next = prepareElementUpdateBatch(slides, [
			{ slideId: 'slide-0', elementId: 'title', patch: { x: 84 } },
			{ slideId: 'slide-1', elementId: 'title', patch: { x: 90 } },
		]);
		expect(slides.map((s) => s.elements[0].x)).toStrictEqual([67, 67]);
		expect(next?.map((s) => s.elements[0].x)).toStrictEqual([84, 90]);
		expect(next?.every((s) => s.isDirty)).toBeTruthy();
	});

	it.each([
		{ slideId: 'missing', elementId: 'title', patch: { x: 90 } },
		{ slideId: 'slide-1', elementId: 'missing', patch: { x: 90 } },
		{ slideId: 'slide-1', elementId: 'title', patch: { x: NaN } },
		{ slideId: 'slide-1', elementId: 'title', patch: { width: -1 } },
		{ slideId: 'slide-1', elementId: 'title', patch: { id: 'changed' } },
	])('rejects the whole batch for $patch', (invalid) => {
		const slides = makeSlides();
		expect(() =>
			prepareElementUpdateBatch(slides, [
				{ slideId: 'slide-0', elementId: 'title', patch: { x: 84 } },
				invalid,
			]),
		).toThrow();
		expect(slides).toStrictEqual(makeSlides());
	});

	it('detects empty, equal and cancelling updates as no net change', () => {
		const slides = makeSlides();
		expect(prepareElementUpdateBatch(slides, [])).toBeNull();
		expect(
			prepareElementUpdateBatch(slides, [
				{ slideId: 'slide-0', elementId: 'title', patch: { x: 67 } },
			]),
		).toBeNull();
		expect(
			prepareElementUpdateBatch(slides, [
				{ slideId: 'slide-0', elementId: 'title', patch: { x: 84 } },
				{ slideId: 'slide-0', elementId: 'title', patch: { x: 67 } },
			]),
		).toBeNull();
	});

	it('does not retain mutable patch input', () => {
		const updates = [
			{ slideId: 'slide-0', elementId: 'title', patch: { textStyle: { bold: true } } },
		];
		const next = prepareElementUpdateBatch(makeSlides(), cloneElementUpdates(updates));
		updates[0].patch.textStyle.bold = false;
		expect(next?.[0].elements[0]).toMatchObject({ textStyle: { bold: true } });
	});

	it('ignores property order when a nested patch has the same values', () => {
		const slides = makeSlides();
		slides[0].elements[0] = { ...slides[0].elements[0], textStyle: { bold: true, fontSize: 24 } };
		expect(
			prepareElementUpdateBatch(slides, [
				{
					slideId: 'slide-0',
					elementId: 'title',
					patch: { textStyle: { fontSize: 24, bold: true } },
				},
			]),
		).toBeNull();
	});

	it('does not commit pending text or history for rejected or unchanged batches', () => {
		const calls: string[] = [];
		const host = {
			getSlides: makeSlides,
			getTarget: () => ({
				canEdit: true,
				loaded: true,
				mode: 'edit' as const,
				editTemplateMode: false,
			}),
			commitPendingText: () => {
				calls.push('text');
			},
			commitSlides: () => {
				calls.push('batch');
			},
		};
		commitElementUpdateBatch([], undefined, host);
		expect(() =>
			commitElementUpdateBatch(
				[{ slideId: 'missing', elementId: 'title', patch: {} }],
				undefined,
				host,
			),
		).toThrow();
		expect(calls).toStrictEqual([]);
	});
});
