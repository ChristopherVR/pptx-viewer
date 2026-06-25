import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import {
	buildSaveSlides,
	isElementInteractive,
	partitionSlides,
	showsTemplateAffordance,
} from './template-mode';

function element(id: string): PptxElement {
	return { type: 'shape', id, name: '', x: 0, y: 0, width: 100, height: 50 } as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements } as PptxSlide;
}

describe('template-mode gate', () => {
	const template = element('layout-shape-3');
	const masterTemplate = element('master-shape-1');
	const normal = element('shape-7');

	it('keeps a layout/master element non-interactive when editTemplateMode is off', () => {
		expect(isElementInteractive(template, true, false)).toBeFalsy();
		expect(isElementInteractive(masterTemplate, true, false)).toBeFalsy();
	});

	it('makes a layout/master element interactive when editTemplateMode is on', () => {
		expect(isElementInteractive(template, true, true)).toBeTruthy();
		expect(isElementInteractive(masterTemplate, true, true)).toBeTruthy();
	});

	it('leaves a normal slide element interactive regardless of editTemplateMode', () => {
		expect(isElementInteractive(normal, true, false)).toBeTruthy();
		expect(isElementInteractive(normal, true, true)).toBeTruthy();
	});

	it('never reports interactive when the canvas base interactivity is off', () => {
		expect(isElementInteractive(normal, false, true)).toBeFalsy();
		expect(isElementInteractive(template, false, true)).toBeFalsy();
	});

	it('shows the affordance only for template elements while editTemplateMode is on', () => {
		expect(showsTemplateAffordance(template, true)).toBeTruthy();
		expect(showsTemplateAffordance(template, false)).toBeFalsy();
		expect(showsTemplateAffordance(normal, true)).toBeFalsy();
	});
});

describe('partitionSlides', () => {
	it('moves layout/master elements into the template store and out of slide.elements', () => {
		const input = [
			slide('s1', [element('master-shape-1'), element('layout-shape-2'), element('shape-3')]),
		];

		const { slides, templateElementsBySlideId } = partitionSlides(input);

		expect(slides[0].elements.map((el) => el.id)).toStrictEqual(['shape-3']);
		expect(templateElementsBySlideId['s1'].map((el) => el.id)).toStrictEqual([
			'master-shape-1',
			'layout-shape-2',
		]);
	});

	it('leaves a template-free slide untouched and records no template entry', () => {
		const input = [slide('s1', [element('shape-1'), element('shape-2')])];

		const { slides, templateElementsBySlideId } = partitionSlides(input);

		expect(slides[0].elements.map((el) => el.id)).toStrictEqual(['shape-1', 'shape-2']);
		expect(templateElementsBySlideId['s1']).toBeUndefined();
	});
});

describe('buildSaveSlides', () => {
	it('merges template elements back behind the slide own elements', () => {
		const merged = buildSaveSlides([slide('s1', [element('shape-3')])], {
			s1: [element('master-shape-1')],
		});

		expect(merged[0].elements.map((el) => el.id)).toStrictEqual(['master-shape-1', 'shape-3']);
	});

	it('returns slides unchanged when there are no template elements', () => {
		const original = slide('s1', [element('shape-1')]);

		const merged = buildSaveSlides([original], {});

		expect(merged[0]).toBe(original);
	});
});

describe('editorStateService editTemplateMode', () => {
	it('defaults to off and toggles via setEditTemplateMode', () => {
		const svc = new EditorStateService();
		expect(svc.editTemplateMode()).toBeFalsy();
		svc.setEditTemplateMode(true);
		expect(svc.editTemplateMode()).toBeTruthy();
		svc.setEditTemplateMode(false);
		expect(svc.editTemplateMode()).toBeFalsy();
	});

	it('partitions template elements out of the editable deck on setSlides', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);

		expect(svc.slides()[0].elements.map((el) => el.id)).toStrictEqual(['shape-2']);
		expect(svc.templateElementsBySlideId()['s1'].map((el) => el.id)).toStrictEqual([
			'master-shape-1',
		]);
	});

	it('routes a template-element edit to the template store and merges it back on save', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);

		svc.updateElement(0, 'master-shape-1', { x: 999 });

		// The edit lands in the template store, never in the editable slide.
		const edited = svc.templateElementsBySlideId()['s1'][0];
		expect(edited.id).toBe('master-shape-1');
		expect(edited.x).toBe(999);
		expect(svc.slides()[0].elements.some((el) => el.id === 'master-shape-1')).toBeFalsy();

		// buildSaveSlides re-merges the EDITED template element into the saved slide.
		const saved = buildSaveSlides(svc.slides(), svc.templateElementsBySlideId());
		const savedMaster = saved[0].elements.find((el) => el.id === 'master-shape-1');
		expect(savedMaster?.x).toBe(999);
		expect(saved[0].elements.map((el) => el.id)).toStrictEqual(['master-shape-1', 'shape-2']);
	});

	it('routes a normal-element edit to the slide without touching the template store', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);
		const templatesBefore = svc.templateElementsBySlideId()['s1'];

		svc.updateElement(0, 'shape-2', { x: 42 });

		expect(svc.slides()[0].elements.find((el) => el.id === 'shape-2')?.x).toBe(42);
		// The template store is structurally unchanged (same element ids + values).
		expect(svc.templateElementsBySlideId()['s1'].map((el) => el.id)).toStrictEqual(
			templatesBefore.map((el) => el.id),
		);
		expect(svc.templateElementsBySlideId()['s1'][0].x).toBe(0);
	});

	it('restores both the slide and template stores on undo of a template edit', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);

		svc.updateElement(0, 'master-shape-1', { x: 999 });
		expect(svc.templateElementsBySlideId()['s1'][0].x).toBe(999);

		svc.undo();
		expect(svc.templateElementsBySlideId()['s1'][0].x).toBe(0);
	});
});
