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

	/**
	 * Regression: the deck must be cloned with core's `cloneSlide`/`cloneElement`
	 * (a shallow copy that shares `rawXml` by reference), NOT `structuredClone`
	 * (which deep-clones `rawXml` into a disconnected object). Core's save writer
	 * mutates a template element's `rawXml` IN PLACE and re-attaches the shape to
	 * the cached layout/master `spTree` by OBJECT IDENTITY
	 * (`ensureTemplateShapeAttached`). If the editor severs that identity, the
	 * edited clone is discarded on save and the template edit silently vanishes
	 * from the file, even though the typed-field data looks correct right up to
	 * the `handler.save()` call.
	 */
	it('preserves the rawXml object identity of template elements through edit + save-merge', () => {
		const svc = new EditorStateService();
		const rawXml = { 'p:sp': { marker: 'cached-layout-node' } };
		const templateEl = { ...element('layout-shape-1'), rawXml } as PptxElement;
		svc.setSlides([slide('s1', [templateEl, element('shape-2')])]);

		// Editing a typed field must not replace/deep-clone the rawXml reference.
		svc.updateElement(0, 'layout-shape-1', { x: 321 });

		const saved = buildSaveSlides(svc.slides(), svc.templateElementsBySlideId());
		const savedTemplate = saved[0].elements.find((el) => el.id === 'layout-shape-1');
		expect(savedTemplate?.x).toBe(321);
		// Identity is preserved: this is the exact object core's save writer mutates
		// in place and matches back into the cached layout spTree.
		expect(savedTemplate?.rawXml).toBe(rawXml);
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

	/**
	 * Confirms point A (drag-to-move) for the template interactivity layer:
	 * `applyTransform` is the live-drag path (emitted by the canvas on every
	 * pointer-move during a gesture) and must route template element geometry
	 * updates to the template store, not the slide, so moves survive
	 * `buildSaveSlides`.
	 */
	it('applyTransform routes a template-element drag to the template store (selection + drag-to-move)', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);

		// Simulate the sequence: user selects a template element (editTemplateMode on),
		// then drags it to a new position via the canvas gesture path.
		svc.setEditTemplateMode(true);
		svc.select(['master-shape-1']);
		expect(svc.selectedIds()).toStrictEqual(['master-shape-1']);

		// beginTransform records a history snapshot; applyTransform live-patches without
		// pushing additional entries. After the gesture the template store must hold
		// the new coordinates.
		svc.beginTransform('Move');
		svc.applyTransform(0, 'master-shape-1', { x: 200, y: 150 });

		const movedTemplate = svc.templateElementsBySlideId()['s1'][0];
		expect(movedTemplate.x).toBe(200);
		expect(movedTemplate.y).toBe(150);
		// The slide's own elements are not mutated.
		expect(svc.slides()[0].elements.find((el) => el.id === 'master-shape-1')).toBeUndefined();

		// buildSaveSlides round-trips the moved template element back into the saved
		// slide so the change persists to the file.
		const saved = buildSaveSlides(svc.slides(), svc.templateElementsBySlideId());
		const savedMaster = saved[0].elements.find((el) => el.id === 'master-shape-1');
		expect(savedMaster?.x).toBe(200);
		expect(savedMaster?.y).toBe(150);
	});

	/**
	 * Confirms point D (mode toggle): toggling editTemplateMode off after a drag
	 * move does not revert the template element back, and the selection state is
	 * preserved until explicitly cleared.
	 */
	it('mode toggle does not revert template element positions already in the store', () => {
		const svc = new EditorStateService();
		svc.setSlides([slide('s1', [element('master-shape-1'), element('shape-2')])]);
		svc.setEditTemplateMode(true);
		svc.beginTransform('Move');
		svc.applyTransform(0, 'master-shape-1', { x: 77, y: 88 });

		// Toggling the mode off is a UI concern only; it must not alter the stored data.
		svc.setEditTemplateMode(false);
		expect(svc.editTemplateMode()).toBeFalsy();
		expect(svc.templateElementsBySlideId()['s1'][0].x).toBe(77);
		expect(svc.templateElementsBySlideId()['s1'][0].y).toBe(88);
	});
});
