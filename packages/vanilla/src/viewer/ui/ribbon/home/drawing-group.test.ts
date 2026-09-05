import { RIBBON_SHAPE_SWATCHES, SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createDrawingGroup } from './drawing-group';

const OFFICE_THEME: Record<string, string> = {
	dk1: '#000000',
	lt1: '#ffffff',
	dk2: '#44546a',
	lt2: '#e7e6e6',
	accent1: '#4472c4',
	accent2: '#ed7d31',
	accent3: '#a5a5a5',
	accent4: '#ffc000',
	accent5: '#5b9bd5',
	accent6: '#70ad47',
	bg1: '#ffffff',
	tx1: '#000000',
	bg2: '#e7e6e6',
	tx2: '#44546a',
};

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

/** The Fill/Outline picker's own popup menu, scoped so a query cannot cross
 * into the other picker's (also-present, just hidden) DOM. */
function menuFor(group: ReturnType<typeof createDrawingGroup>, label: string): HTMLElement {
	return control(group, label)
		.closest('.pptxv-swatch-picker')!
		.querySelector('.pptxv-swatch-menu')!;
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

// W3-G2 follow-up: the deck's real "Theme Colors" grid, above the standard
// swatches, on the ribbon's Shape Fill / Shape Outline pickers.
describe('createDrawingGroup Shape Fill / Shape Outline theme colours', () => {
	it('offers the twelve RIBBON_SHAPE_SWATCHES as the flat standard-colour row', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true });
		control(group, t('pptx.drawing.shapeFill')).click();
		const swatches = menuFor(group, t('pptx.drawing.shapeFill')).querySelectorAll('.pptxv-swatch');
		expect(swatches).toHaveLength(RIBBON_SHAPE_SWATCHES.length);
	});

	it('renders one theme-swatch grid per picker, hidden until a theme is loaded', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true });

		const grids = group.el.querySelectorAll('.pptxv-theme-swatch-grid');
		expect(grids).toHaveLength(2);
		for (const grid of grids) {
			expect((grid as HTMLElement).hidden).toBeTruthy();
		}

		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });
		for (const grid of group.el.querySelectorAll('.pptxv-theme-swatch-grid')) {
			expect((grid as HTMLElement).hidden).toBeFalsy();
		}
	});

	it('shows a "Standard Colors" label above the flat swatch row', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true });
		control(group, t('pptx.drawing.shapeFill')).click();
		const label = menuFor(group, t('pptx.drawing.shapeFill')).querySelector<HTMLElement>(
			'.pptxv-swatch-standard-label',
		)!;
		expect(label.textContent).toBe(t('pptx.colorPicker.standardColors'));
	});

	it('clicking a theme swatch commits both the hex and the ref for fill and outline', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createDrawingGroup(document, t, actions);
		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });

		control(group, t('pptx.drawing.shapeFill')).click();
		menuFor(group, t('pptx.drawing.shapeFill'))
			.querySelector<HTMLButtonElement>('button[title="Accent 2"]')!
			.click();
		expect(actions.setShapeFill).toHaveBeenCalledExactlyOnceWith('#ed7d31', { scheme: 'accent2' });
		expect(actions.setShapeStroke).not.toHaveBeenCalled();

		control(group, t('pptx.drawing.shapeOutline')).click();
		menuFor(group, t('pptx.drawing.shapeOutline'))
			.querySelector<HTMLButtonElement>('button[title="Accent 2"]')!
			.click();
		expect(actions.setShapeStroke).toHaveBeenCalledExactlyOnceWith('#ed7d31', {
			scheme: 'accent2',
		});
	});

	it('clicking a standard swatch commits the hex with no ref', () => {
		const t = createTranslator();
		const actions = handlers();
		const group = createDrawingGroup(document, t, actions);
		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });

		control(group, t('pptx.drawing.shapeFill')).click();
		menuFor(group, t('pptx.drawing.shapeFill'))
			.querySelector<HTMLButtonElement>('.pptxv-swatch')!
			.click();
		expect(actions.setShapeFill).toHaveBeenCalledExactlyOnceWith(expect.any(String));
	});

	it('highlights the selected shape fill/outline theme ref', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({
			editable: true,
			hasSelection: true,
			themeColorMap: OFFICE_THEME,
			fillColorRef: { scheme: 'accent2' },
			fillColor: '#ed7d31',
		});

		control(group, t('pptx.drawing.shapeFill')).click();
		const swatch = menuFor(group, t('pptx.drawing.shapeFill')).querySelector<HTMLButtonElement>(
			'button[title="Accent 2"]',
		)!;
		expect(swatch.classList.contains('is-selected')).toBeTruthy();
	});

	it('disables both grids when nothing is selected', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: false, themeColorMap: OFFICE_THEME });

		for (const grid of group.el.querySelectorAll('.pptxv-theme-swatch-grid')) {
			expect(
				grid.querySelector<HTMLButtonElement>('.pptxv-theme-swatch-grid-swatch')!.disabled,
			).toBeTruthy();
		}
	});
});
