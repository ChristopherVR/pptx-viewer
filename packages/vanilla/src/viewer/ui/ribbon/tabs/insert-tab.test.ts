import { CATEGORIES, INSERT_CHART_TYPES, PRESETS, SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { allButtons } from '../../dialog-footer.test-support';
import type { RibbonInsertHandlers } from '../ribbon-types';
import { createInsertTab } from './insert-tab';

function makeHandlers(over: Partial<RibbonInsertHandlers> = {}): RibbonInsertHandlers {
	return {
		insert: vi.fn(),
		insertImage: vi.fn(),
		insertMedia: vi.fn(),
		insertChart: vi.fn(),
		insertSmartArt: vi.fn(),
		insertEquation: vi.fn(),
		insertActionButton: vi.fn(),
		insertField: vi.fn(),
		...over,
	};
}

function make(over: Partial<RibbonInsertHandlers> = {}, spies: Record<string, () => void> = {}) {
	const tab = createInsertTab(
		document,
		createTranslator(),
		makeHandlers(over),
		spies.equation ?? vi.fn(),
		spies.headerFooter ?? vi.fn(),
		spies.hyperlink ?? vi.fn(),
	);
	document.body.append(tab.el);
	return tab;
}
function control(tab: { el: HTMLElement }, id: string): HTMLButtonElement {
	return tab.el
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}
/** Open a gallery menu (Shapes, Chart) and choose an entry; the pick stages, then inserts. */
function choose(tab: { el: HTMLElement }, id: string, value: string): void {
	tab.el.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"] .trigger`)!.click();
	tab.el
		.querySelector<HTMLButtonElement>(
			`[data-ribbon-control="${id}"] [data-insert-item="${value}"]`,
		)!
		.click();
	vi.runAllTimers();
}
function dialog(): HTMLElement | null {
	return document.querySelector<HTMLElement>('[role="dialog"][aria-label="Insert SmartArt"]');
}
function dialogButton(name: string): HTMLButtonElement | undefined {
	const root = dialog();
	return (root ? allButtons(root) : []).find((button) => button.textContent === name);
}

describe('createInsertTab', () => {
	afterEach(() => document.body.replaceChildren());

	it('offers the Freeform: Shape and Curve tools and arms / disarms them', () => {
		const armFreeformTool = vi.fn();
		const tab = make({ armFreeformTool, visibleDrawingTools: () => ['freeformShape', 'curve'] });
		const freeform = tab.el.querySelector<HTMLElement>('[data-pptx-drawing-tool="freeformShape"]')!;
		const curve = tab.el.querySelector<HTMLElement>('[data-pptx-drawing-tool="curve"]')!;
		const inner = curve.shadowRoot!.querySelector('button')!;
		expect(freeform.getAttribute('label')).toBe('Freeform: Shape');
		expect(inner.getAttribute('aria-pressed')).toBe('false');
		curve.click();
		expect(armFreeformTool).toHaveBeenLastCalledWith('curve');
		tab.setFreeformTool('curve');
		expect(inner.getAttribute('aria-pressed')).toBe('true');
		curve.click();
		expect(armFreeformTool).toHaveBeenLastCalledWith(null);
	});

	it('leaves the drawing tools out when the host hides them', () => {
		const tab = make({ armFreeformTool: vi.fn(), visibleDrawingTools: () => ['curve'] });
		expect(
			tab.el.querySelector<HTMLElement>('[data-pptx-drawing-tool="freeformShape"]')!.hidden,
		).toBeTruthy();
		expect(
			tab.el.querySelector<HTMLElement>('[data-pptx-drawing-tool="curve"]')!.hidden,
		).toBeFalsy();
		const none = make();
		expect(none.el.querySelector<HTMLElement>('.stack')!.hidden).toBeTruthy();
	});

	it('renders the shared Insert element with every public group and control id', () => {
		const tab = make();
		expect(tab.el.querySelector('pptx-ui-ribbon-insert')).not.toBeNull();
		for (const id of [
			'insert.tables',
			'insert.images',
			'insert.illustrations',
			'insert.links',
			'insert.text',
			'insert.symbols',
			'insert.media',
		]) {
			expect(tab.el.querySelectorAll(`[data-ribbon-group="${id}"]`)).toHaveLength(1);
		}
		const items = (id: string) =>
			tab.el.querySelectorAll(`[data-ribbon-control="${id}"] [data-insert-item]`);
		expect(items('insert.illustrations.shapes')).toHaveLength(SHAPE_PRESET_DEFS.length);
		expect(items('insert.illustrations.chart')).toHaveLength(INSERT_CHART_TYPES.length);
		// Shapes, Chart, Action and Field are large dropdowns, not selects beside a button.
		expect(tab.el.querySelectorAll('select')).toHaveLength(0);
		expect(tab.el.querySelectorAll('.trigger.large')).toHaveLength(4);
	});

	it('opens the hyperlink editor and needs a selection to be usable', () => {
		const hyperlink = vi.fn();
		const tab = make({}, { hyperlink });
		const link = control(tab, 'insert.links.link');
		// A link always attaches to something, so an empty selection is enough to
		// rule the command out even on an editable deck.
		expect(link.disabled).toBeTruthy();
		tab.setEditable(true);
		expect(link.disabled).toBeTruthy();
		tab.setHasSelection(true);
		expect(link.disabled).toBeFalsy();
		link.click();
		expect(hyperlink).toHaveBeenCalledOnce();
		tab.setHasSelection(false);
		expect(link.disabled).toBeTruthy();
	});

	it('dispatches insert("text") / insert("table") for the fixed buttons', () => {
		const insert = vi.fn();
		const tab = make({ insert });
		control(tab, 'insert.text.textBox').click();
		control(tab, 'insert.tables.table').click();
		expect(insert).toHaveBeenCalledWith('text');
		expect(insert).toHaveBeenCalledWith('table');
	});

	it('inserts the shape chosen from the Shapes gallery', () => {
		vi.useFakeTimers();
		const insert = vi.fn();
		const tab = make({ insert });
		choose(tab, 'insert.illustrations.shapes', SHAPE_PRESET_DEFS[2].type);
		vi.useRealTimers();
		expect(insert).toHaveBeenCalledWith('shape', SHAPE_PRESET_DEFS[2].type);
	});

	it('calls insertImage() and insertMedia() for their buttons', () => {
		const insertImage = vi.fn();
		const insertMedia = vi.fn();
		const tab = make({ insertImage, insertMedia });
		control(tab, 'insert.images.pictures').click();
		control(tab, 'insert.media.media').click();
		expect(insertImage).toHaveBeenCalledOnce();
		expect(insertMedia).toHaveBeenCalledOnce();
	});

	it('inserts the chart chosen from the Chart gallery, including Bar and Pareto', () => {
		vi.useFakeTimers();
		const insertChart = vi.fn();
		const tab = make({ insertChart });
		// The gallery carries the entry id: Column and Bar share the 'bar' family.
		for (const id of [INSERT_CHART_TYPES[0].id, 'bar', 'pareto']) {
			choose(tab, 'insert.illustrations.chart', id);
			expect(insertChart).toHaveBeenLastCalledWith(id);
		}
		vi.useRealTimers();
	});

	it('opens the Header & Footer dialog and the equation panel', () => {
		const headerFooter = vi.fn();
		const equation = vi.fn();
		const tab = make({}, { headerFooter, equation });
		const header = [...tab.el.querySelectorAll<HTMLElement>('pptx-ui-ribbon-command')].find(
			(el) => !el.dataset.ribbonControl && !el.dataset.pptxDrawingTool,
		)!;
		header.shadowRoot!.querySelector('button')!.click();
		control(tab, 'insert.symbols.equation').click();
		expect(headerFooter).toHaveBeenCalledOnce();
		expect(equation).toHaveBeenCalledOnce();
	});

	it('opens an accessible SmartArt dialog and confirms the selected layout', () => {
		const insertSmartArt = vi.fn();
		const tab = make({ insertSmartArt });
		control(tab, 'insert.illustrations.smartArt').click();
		const panel = dialog();
		expect(panel).not.toBeNull();
		expect(panel?.parentElement?.hidden).toBeFalsy();
		expect(panel?.querySelector('[role="listbox"][aria-label="SmartArt layouts"]')).not.toBeNull();
		const option = panel?.querySelector<HTMLButtonElement>('[role="option"]');
		const insertButton = dialogButton('Insert');
		expect(insertButton?.disabled).toBeTruthy();
		option?.click();
		expect(option?.getAttribute('aria-selected')).toBe('true');
		insertButton?.click();
		expect(insertSmartArt).toHaveBeenCalledWith(PRESETS[0].layout, PRESETS[0].defaultItems);
		expect(panel?.parentElement?.hidden).toBeTruthy();
	});

	it('filters SmartArt layouts by category and resets selection', () => {
		const tab = make();
		control(tab, 'insert.illustrations.smartArt').click();
		dialog()?.querySelector<HTMLButtonElement>('[role="option"]')?.click();
		const category = CATEGORIES[1];
		Array.from(dialog()?.querySelectorAll<HTMLButtonElement>('.pptxv-smartart-category') ?? [])
			.find((button) => button.dataset.category === category.id)
			?.click();
		const expected = PRESETS.filter((preset) => preset.category === category.id);
		const options = dialog()?.querySelectorAll<HTMLElement>('[role="option"]') ?? [];
		expect(options).toHaveLength(expected.length);
		expect(
			Array.from(options).every((option) => option.getAttribute('aria-selected') === 'false'),
		).toBeTruthy();
		expect(dialogButton('Insert')?.disabled).toBeTruthy();
	});

	it('cancels SmartArt insertion and returns focus to the SmartArt control', () => {
		const insertSmartArt = vi.fn();
		const tab = make({ insertSmartArt });
		const smartArt = control(tab, 'insert.illustrations.smartArt');
		smartArt.click();
		const panel = dialog();
		panel?.querySelector<HTMLButtonElement>('[role="option"]')?.click();
		dialogButton('Cancel')?.click();
		expect(insertSmartArt).not.toHaveBeenCalled();
		expect(panel?.parentElement?.hidden).toBeTruthy();
		expect(tab.el.querySelector('[data-ribbon-control="insert.illustrations.smartArt"]')).toBe(
			document.activeElement,
		);
	});

	it('dispatches insertActionButton(type) and insertField(type) from the shared menus', () => {
		const insertActionButton = vi.fn();
		const insertField = vi.fn();
		const tab = make({ insertActionButton, insertField });
		for (const id of ['insert.links.action', 'insert.text.field']) {
			tab.el.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"] .trigger`)!.click();
			tab.el
				.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"] [role=menuitem]`)!
				.click();
		}
		expect(insertActionButton).toHaveBeenCalledOnce();
		expect(insertField).toHaveBeenCalledWith('slidenum');
	});

	it('setEditable disables/enables every editing control but not Link', () => {
		const tab = make();
		const editing = ['insert.text.textBox', 'insert.tables.table', 'insert.media.media'];
		tab.setEditable(false);
		expect(editing.every((id) => control(tab, id).disabled)).toBeTruthy();
		for (const trigger of tab.el.querySelectorAll<HTMLButtonElement>('.trigger')) {
			expect(trigger.disabled).toBeTruthy();
		}
		tab.setEditable(true);
		expect(editing.every((id) => !control(tab, id).disabled)).toBeTruthy();
	});
});
