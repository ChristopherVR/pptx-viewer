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
		setShapeFill: vi.fn(),
		setShapeStroke: vi.fn(),
	};
}

type Group = ReturnType<typeof createDrawingGroup>;

const slot = (group: Group, id: string) =>
	group.el.querySelector<HTMLElement>(`[data-ribbon-control="home.drawing.${id}"]`)!;
const trigger = (group: Group, id: string) => slot(group, id).querySelector('button')!;

describe('createDrawingGroup', () => {
	it('renders the shared drawing strip with the public ids and both galleries', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		expect(group.el.getAttribute('data-ribbon-group')).toBe('home.drawing');
		expect(group.el.querySelector('pptx-ui-ribbon-home-drawing')).not.toBeNull();
		for (const id of ['shapes', 'arrange', 'shapeFill', 'shapeOutline']) {
			expect(slot(group, id)).toBeTruthy();
		}
		expect(
			group.el.querySelector('[data-ribbon-control="home.drawing.quickStyles"]'),
		).not.toBeNull();
		expect(
			group.el.querySelector('[data-ribbon-control="home.drawing.shapeEffects"]'),
		).not.toBeNull();
	});

	it('inserts a preset from the Shapes menu', () => {
		const actions = handlers();
		const group = createDrawingGroup(document, createTranslator(), actions);
		group.update({ editable: true, hasSelection: false });
		trigger(group, 'shapes').click();
		slot(group, 'shapes').querySelector<HTMLElement>('[role="menuitem"]')?.click();
		expect(actions.insertShape).toHaveBeenCalledWith(SHAPE_PRESET_DEFS[0].type);
	});

	it('runs the four z-order commands from the Arrange menu', () => {
		const actions = handlers();
		const group = createDrawingGroup(document, createTranslator(), actions);
		group.update({ editable: true, hasSelection: true });
		trigger(group, 'arrange').click();
		for (const row of slot(group, 'arrange').querySelectorAll<HTMLElement>('[role="menuitem"]')) {
			trigger(group, 'arrange').click();
			row.click();
		}
		expect(actions.bringForward).toHaveBeenCalledOnce();
		expect(actions.sendBackward).toHaveBeenCalledOnce();
		expect(actions.bringToFront).toHaveBeenCalledOnce();
		expect(actions.sendToBack).toHaveBeenCalledOnce();
	});

	it('reflects the open menu as expanded', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		group.update({ editable: true, hasSelection: true });
		const button = trigger(group, 'shapes');
		expect(button.getAttribute('aria-expanded')).toBe('false');
		button.click();
		expect(button.getAttribute('aria-expanded')).toBe('true');
		button.click();
		expect(button.getAttribute('aria-expanded')).toBe('false');
	});

	it('shows the deck recent colours in the fill popover', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		group.update({ editable: true, hasSelection: true, recentColors: ['#112233'] });
		trigger(group, 'shapeFill').click();
		expect(
			slot(group, 'shapeFill').querySelector('[data-testid="pptx-color-recent"] .sw'),
		).not.toBeNull();
	});

	it('needs a selection before fill, outline and arrange are usable', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		group.update({ editable: true, hasSelection: false });
		expect(trigger(group, 'shapeFill').disabled).toBeTruthy();
		expect(trigger(group, 'arrange').disabled).toBeTruthy();
		// Inserting a shape does not need one.
		expect(trigger(group, 'shapes').disabled).toBeFalsy();
		group.update({ editable: true, hasSelection: true });
		expect(trigger(group, 'shapeFill').disabled).toBeFalsy();
		expect(trigger(group, 'shapeOutline').disabled).toBeFalsy();
	});
});

describe('createDrawingGroup Shape Fill / Shape Outline colours', () => {
	it('offers the twelve standard swatches and the Standard Colors heading', () => {
		const t = createTranslator();
		const group = createDrawingGroup(document, t, handlers());
		group.update({ editable: true, hasSelection: true });
		trigger(group, 'shapeFill').click();
		expect(slot(group, 'shapeFill').querySelectorAll('.std-grid .sw')).toHaveLength(
			RIBBON_SHAPE_SWATCHES.length,
		);
		expect(slot(group, 'shapeFill').querySelector('.heading')?.textContent).toBe(
			t('pptx.colorPicker.standardColors'),
		);
	});

	it('shows the theme grid only once a theme is loaded', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		group.update({ editable: true, hasSelection: true });
		trigger(group, 'shapeFill').click();
		expect(slot(group, 'shapeFill').querySelector('.theme-grid')).toBeNull();
		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });
		expect(slot(group, 'shapeFill').querySelector('.theme-grid')).not.toBeNull();
	});

	it('commits both the hex and the ref for a theme swatch, for fill and outline', () => {
		const actions = handlers();
		const group = createDrawingGroup(document, createTranslator(), actions);
		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });
		trigger(group, 'shapeFill').click();
		slot(group, 'shapeFill').querySelector<HTMLElement>('button[title="Accent 2"]')!.click();
		expect(actions.setShapeFill).toHaveBeenCalledExactlyOnceWith('#ed7d31', { scheme: 'accent2' });
		expect(actions.setShapeStroke).not.toHaveBeenCalled();
		trigger(group, 'shapeOutline').click();
		slot(group, 'shapeOutline').querySelector<HTMLElement>('button[title="Accent 2"]')!.click();
		expect(actions.setShapeStroke).toHaveBeenCalledExactlyOnceWith('#ed7d31', {
			scheme: 'accent2',
		});
	});

	it('commits a standard swatch as a plain hex', () => {
		const actions = handlers();
		const group = createDrawingGroup(document, createTranslator(), actions);
		group.update({ editable: true, hasSelection: true, themeColorMap: OFFICE_THEME });
		trigger(group, 'shapeFill').click();
		slot(group, 'shapeFill').querySelector<HTMLElement>('.std-grid .sw')!.click();
		expect(actions.setShapeFill).toHaveBeenCalledExactlyOnceWith(
			RIBBON_SHAPE_SWATCHES[0],
			undefined,
		);
	});

	it('highlights the selected shape fill theme ref', () => {
		const group = createDrawingGroup(document, createTranslator(), handlers());
		group.update({
			editable: true,
			hasSelection: true,
			themeColorMap: OFFICE_THEME,
			fillColorRef: { scheme: 'accent2' },
			fillColor: '#ed7d31',
		});
		trigger(group, 'shapeFill').click();
		const swatch = slot(group, 'shapeFill').querySelector<HTMLElement>('button[title="Accent 2"]')!;
		expect(swatch.getAttribute('aria-pressed')).toBe('true');
	});

	it('re-translates the popover headings when the strip is rebuilt for another locale', () => {
		const french = (key: string) => (key === 'pptx.colorPicker.standardColors' ? 'Couleurs' : key);
		const group = createDrawingGroup(document, french as never, handlers());
		group.update({ editable: true, hasSelection: true });
		trigger(group, 'shapeFill').click();
		expect(slot(group, 'shapeFill').querySelector('.heading')?.textContent).toBe('Couleurs');
	});
});
