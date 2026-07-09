import { describe, expect, it } from 'vitest';

import type { PptxElement, PptxElementAnimation, PptxNativeAnimation, XmlObject } from '../types';
import { reconcileAnimationTargets } from './animation-target-reconcile';

/** Build a minimal shape element whose rawXml carries a `cNvPr/@id`. */
function shapeEl(id: string, cNvPrId: string, nvKey = 'p:nvSpPr'): PptxElement {
	return {
		type: 'shape',
		id,
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		rawXml: { [nvKey]: { 'p:cNvPr': { '@_id': cNvPrId } } } as XmlObject,
	} as PptxElement;
}

describe('reconcileAnimationTargets', () => {
	it('rewrites native targetId from cNvPr id to positional element.id', () => {
		const elements = [shapeEl('slide1-shape-0', '2'), shapeEl('slide1-shape-1', '3')];
		const native: PptxNativeAnimation[] = [
			{ targetId: '3', presetClass: 'entr' },
			{ targetId: '2', presetClass: 'exit' },
		];

		reconcileAnimationTargets(elements, native, undefined);

		expect(native[0].targetId).toBe('slide1-shape-1');
		expect(native[1].targetId).toBe('slide1-shape-0');
	});

	it('stamps element.shapeId from the cNvPr id', () => {
		const elements = [shapeEl('slide1-shape-0', '2'), shapeEl('slide1-shape-1', '3')];
		reconcileAnimationTargets(elements, [], []);
		expect(elements[0].shapeId).toBe('2');
		expect(elements[1].shapeId).toBe('3');
	});

	it('rewrites interactive triggerShapeId too', () => {
		const elements = [shapeEl('slide1-shape-0', '7'), shapeEl('slide1-shape-1', '8')];
		const native: PptxNativeAnimation[] = [
			{ targetId: '8', triggerShapeId: '7', trigger: 'onShapeClick' },
		];
		reconcileAnimationTargets(elements, native, undefined);
		expect(native[0].targetId).toBe('slide1-shape-1');
		expect(native[0].triggerShapeId).toBe('slide1-shape-0');
	});

	it('rewrites editor animation elementId', () => {
		const elements = [shapeEl('slide1-shape-0', '2'), shapeEl('slide1-shape-1', '3')];
		const editor: PptxElementAnimation[] = [{ elementId: '3', entrance: 'fadeIn' }];
		reconcileAnimationTargets(elements, undefined, editor);
		expect(editor[0].elementId).toBe('slide1-shape-1');
	});

	it('leaves unresolvable ids untouched (text-build sub-ids, already-positional)', () => {
		const elements = [shapeEl('slide1-shape-0', '2')];
		const native: PptxNativeAnimation[] = [
			{ targetId: '2::txbuild::0', presetClass: 'entr' },
			{ targetId: 'slide1-shape-0', presetClass: 'entr' },
		];
		reconcileAnimationTargets(elements, native, undefined);
		expect(native[0].targetId).toBe('2::txbuild::0');
		expect(native[1].targetId).toBe('slide1-shape-0');
	});

	it('resolves cNvPr ids of shapes nested inside a group', () => {
		const child = shapeEl('slide1-group-0-child', '5');
		const group: PptxElement = {
			type: 'group',
			id: 'slide1-group-0',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [child],
			rawXml: { 'p:nvGrpSpPr': { 'p:cNvPr': { '@_id': '4' } } } as XmlObject,
		} as PptxElement;
		const native: PptxNativeAnimation[] = [{ targetId: '5', presetClass: 'entr' }];
		reconcileAnimationTargets([group], native, undefined);
		expect(native[0].targetId).toBe('slide1-group-0-child');
	});

	it('excludes template (layout/master) elements from the resolution map', () => {
		const elements = [shapeEl('layout-shape-abc-0', '3'), shapeEl('slide1-shape-0', '9')];
		const native: PptxNativeAnimation[] = [{ targetId: '3', presetClass: 'entr' }];
		reconcileAnimationTargets(elements, native, undefined);
		// cNvPr id 3 belongs only to a template element, so it stays unresolved.
		expect(native[0].targetId).toBe('3');
	});
});
