import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createDrawingGroup } from './drawing-group';

function handlers() {
	return {
		insertShape: vi.fn(),
		bringForward: vi.fn(),
		sendBackward: vi.fn(),
		bringToFront: vi.fn(),
		sendToBack: vi.fn(),
		groupSelected: vi.fn(),
		ungroupSelected: vi.fn(),
		setShapeFill: vi.fn(),
		setShapeStroke: vi.fn(),
	};
}

function control(group: ReturnType<typeof createDrawingGroup>, label: string): HTMLButtonElement {
	const match = [...group.el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing drawing control: ${label}`);
	}
	return match;
}

describe('createDrawingGroup', () => {
	it('offers the five Drawing commands React does', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		for (const label of [
			t('pptx.drawing.shapes'),
			t('pptx.ribbon.arrange'),
			t('pptx.drawing.shapeFill'),
			t('pptx.drawing.shapeOutline'),
			t('pptx.drawing.shapeEffectsUnavailable'),
		]) {
			expect(control(group, label)).toBeTruthy();
		}
	});

	it('inserts a preset from the Shapes menu', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createDrawingGroup(document, t, actions);
		group.update({ editable: true, hasSelection: false });
		control(group, t('pptx.drawing.shapes')).click();
		group.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-item')?.click();
		expect(actions.insertShape).toHaveBeenCalledWith(SHAPE_PRESET_DEFS[0].type);
	});

	it('keeps Group and Ungroup reachable from the Arrange menu', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createDrawingGroup(document, t, actions);
		group.update({ editable: true, hasSelection: true });
		const arrangeMenu = group.el.querySelectorAll('.pptxv-dropdown')[1];
		const items = [...arrangeMenu.querySelectorAll<HTMLButtonElement>('.pptxv-dropdown-item')];
		const byLabel = (label: string) => items.find((item) => item.textContent === label);
		byLabel(t('pptx.ribbon.group'))?.click();
		byLabel(t('pptx.ribbon.ungroup'))?.click();
		expect(actions.groupSelected).toHaveBeenCalledOnce();
		expect(actions.ungroupSelected).toHaveBeenCalledOnce();
	});

	it('leaves Shape Effects permanently unavailable, as React does', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true });
		expect(control(group, t('pptx.drawing.shapeEffectsUnavailable')).disabled).toBeTruthy();
	});

	// B6: both pickers show the same deck-level "Recent colours" row.
	it('threads recentColors into the fill and outline pickers', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true, recentColors: ['#112233'] });

		control(group, t('pptx.drawing.shapeFill')).click();
		expect(
			group.el.querySelector('[data-testid="pptx-color-recent"] .pptxv-swatch'),
		).not.toBeNull();
	});

	it('needs a selection before fill, outline and arrange are usable', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: false });
		expect(control(group, t('pptx.drawing.shapeFill')).disabled).toBeTruthy();
		expect(control(group, t('pptx.ribbon.arrange')).disabled).toBeTruthy();
		// Inserting a shape does not need one.
		expect(control(group, t('pptx.drawing.shapes')).disabled).toBeFalsy();

		group.update({ editable: true, hasSelection: true });
		expect(control(group, t('pptx.drawing.shapeFill')).disabled).toBeFalsy();
		expect(control(group, t('pptx.drawing.shapeOutline')).disabled).toBeFalsy();
	});
});
