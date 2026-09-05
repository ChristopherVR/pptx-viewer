import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createArrangeExtras } from './arrange-extras';

function shapeElement(strokeWidth?: number): PptxElement {
	return {
		type: 'shape',
		id: 'sh-1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		shapeType: 'rect',
		shapeStyle: strokeWidth === undefined ? {} : { strokeWidth },
	} as PptxElement;
}

function groupElement(): PptxElement {
	return {
		type: 'group',
		id: 'grp-1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		children: [],
	} as PptxElement;
}

describe('createArrangeExtras', () => {
	it('routes gating through the shared canGroupSelection/canUngroupSelection/canSetStrokeWidth decisions', () => {
		const handlers = { groupSelected: vi.fn(), ungroupSelected: vi.fn(), setStrokeWidth: vi.fn() };
		const extras = createArrangeExtras(document, createTranslator(), handlers);
		const group = extras.el.querySelector('button:nth-of-type(1)') as HTMLButtonElement;
		const ungroup = extras.el.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
		const stroke = extras.el.querySelector('input') as HTMLInputElement;

		// Not editable: everything disabled regardless of selection.
		extras.update({
			editable: false,
			selectedCount: 2,
			selectionGroupable: true,
			selectedElement: groupElement(),
		});
		expect(group.disabled).toBeTruthy();
		expect(ungroup.disabled).toBeTruthy();
		expect(stroke.disabled).toBeTruthy();

		// Editable, two shapes selected (no single active element): Group enabled,
		// Ungroup/stroke gated on there being an active element that qualifies.
		extras.update({
			editable: true,
			selectedCount: 2,
			selectionGroupable: true,
			selectedElement: undefined,
		});
		expect(group.disabled).toBeFalsy();
		expect(ungroup.disabled).toBeTruthy();
		expect(stroke.disabled).toBeTruthy();

		// Editable, a single shape selected: stroke width editable, shows its value.
		extras.update({
			editable: true,
			selectedCount: 1,
			selectionGroupable: true,
			selectedElement: shapeElement(3),
		});
		expect(stroke.disabled).toBeFalsy();
		expect(stroke.value).toBe('3');
		expect(ungroup.disabled).toBeTruthy();

		// Editable, a group selected: Ungroup enabled.
		extras.update({
			editable: true,
			selectedCount: 1,
			selectionGroupable: true,
			selectedElement: groupElement(),
		});
		expect(ungroup.disabled).toBeFalsy();
	});

	it('disables Group when a:spLocks/@noGrp locks a selected element even with two selected', () => {
		const handlers = { groupSelected: vi.fn(), ungroupSelected: vi.fn(), setStrokeWidth: vi.fn() };
		const extras = createArrangeExtras(document, createTranslator(), handlers);
		const group = extras.el.querySelector('button:nth-of-type(1)') as HTMLButtonElement;

		extras.update({
			editable: true,
			selectedCount: 2,
			selectionGroupable: false,
			selectedElement: undefined,
		});

		expect(group.disabled).toBeTruthy();
	});

	it('disables Ungroup when a:grpSpLocks/@noGrp is set on the group itself', () => {
		const handlers = { groupSelected: vi.fn(), ungroupSelected: vi.fn(), setStrokeWidth: vi.fn() };
		const extras = createArrangeExtras(document, createTranslator(), handlers);
		const ungroup = extras.el.querySelector('button:nth-of-type(2)') as HTMLButtonElement;
		const lockedGroup = { ...groupElement(), locks: { noGrouping: true } } as PptxElement;

		extras.update({
			editable: true,
			selectedCount: 1,
			selectionGroupable: true,
			selectedElement: lockedGroup,
		});

		expect(ungroup.disabled).toBeTruthy();
	});

	it('falls back to the shared DEFAULT_STROKE_WIDTH for a shape with no explicit width', () => {
		const handlers = { groupSelected: vi.fn(), ungroupSelected: vi.fn(), setStrokeWidth: vi.fn() };
		const extras = createArrangeExtras(document, createTranslator(), handlers);
		const stroke = extras.el.querySelector('input') as HTMLInputElement;

		extras.update({
			editable: true,
			selectedCount: 1,
			selectionGroupable: true,
			selectedElement: shapeElement(undefined),
		});

		expect(stroke.value).toBe('1');
	});
});
