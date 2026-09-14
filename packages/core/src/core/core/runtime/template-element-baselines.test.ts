import { describe, expect, it } from 'vitest';

import type { PptxElement, ShapePptxElement } from '../../types';
import { TemplateElementBaselineTracker } from './template-element-baselines';

function shape(id: string, fillColor: string, shapeId?: number): ShapePptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
		shapeStyle: { fillMode: 'solid', fillColor },
		shapeId,
		rawXml: { 'p:spPr': {} },
	} as ShapePptxElement;
}

describe('template element baseline tracker', () => {
	it('skips a copy that still matches its as-parsed baseline', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000');
		tracker.recordBaselines([pristine]);

		tracker.beginSave();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
	});

	it('writes a copy that has no baseline at all', () => {
		const tracker = new TemplateElementBaselineTracker();
		tracker.beginSave();
		expect(tracker.shouldWriteBack(shape('layout-shape-1', '#000000'))).toBeTruthy();
	});

	it('ignores rawXml and shapeId when comparing against the baseline', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000', 7);
		tracker.recordBaselines([pristine]);

		const renumbered: PptxElement = { ...pristine, shapeId: 99, rawXml: { 'p:spPr': { x: 1 } } };
		tracker.beginSave();
		expect(tracker.shouldWriteBack(renumbered)).toBeFalsy();
	});

	it('records a baseline only once per id', () => {
		const tracker = new TemplateElementBaselineTracker();
		tracker.recordBaselines([shape('layout-shape-1', '#000000')]);
		tracker.recordBaselines([shape('layout-shape-1', '#FF0000')]);

		tracker.beginSave();
		expect(tracker.shouldWriteBack(shape('layout-shape-1', '#000000'))).toBeFalsy();
		expect(tracker.shouldWriteBack(shape('layout-shape-1', '#FF0000'))).toBeTruthy();
	});

	it('writes the edited copy, then marks the untouched sibling copy stale', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000');
		tracker.recordBaselines([pristine]);
		const edited = shape('layout-shape-1', '#FF0000');

		// First save: the edited copy on slide 1, the pristine copy on slide 2.
		tracker.beginSave();
		expect(tracker.shouldWriteBack(edited)).toBeTruthy();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
		tracker.commitSave();

		// Second save: the same two objects again. The edit is now the
		// baseline, and the stale pristine object must not write it back.
		tracker.beginSave();
		expect(tracker.shouldWriteBack(edited)).toBeFalsy();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
		tracker.commitSave();
	});

	it('still writes a NEW object carrying the original values (an undo)', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000');
		tracker.recordBaselines([pristine]);
		const edited = shape('layout-shape-1', '#FF0000');

		tracker.beginSave();
		tracker.shouldWriteBack(edited);
		tracker.shouldWriteBack(pristine);
		tracker.commitSave();

		const undone = shape('layout-shape-1', '#000000');
		tracker.beginSave();
		expect(tracker.shouldWriteBack(undone)).toBeTruthy();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
		tracker.commitSave();

		// The undo is now the baseline; neither the undone copy nor the stale
		// one has anything left to write.
		tracker.beginSave();
		expect(tracker.shouldWriteBack(undone)).toBeFalsy();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
	});

	it('does not let slide order decide which copy wins', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000');
		tracker.recordBaselines([pristine]);
		const edited = shape('layout-shape-1', '#FF0000');

		tracker.beginSave();
		expect(tracker.shouldWriteBack(pristine)).toBeFalsy();
		expect(tracker.shouldWriteBack(edited)).toBeTruthy();
	});

	it('forgets baselines and stale copies on reset', () => {
		const tracker = new TemplateElementBaselineTracker();
		const pristine = shape('layout-shape-1', '#000000');
		tracker.recordBaselines([pristine]);
		tracker.beginSave();
		tracker.shouldWriteBack(shape('layout-shape-1', '#FF0000'));
		tracker.shouldWriteBack(pristine);
		tracker.commitSave();

		tracker.reset();
		tracker.beginSave();
		expect(tracker.shouldWriteBack(pristine)).toBeTruthy();
	});
});
