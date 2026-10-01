// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { RibbonInsertState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const STATE: RibbonInsertState = {
	editable: true,
	hasSelection: true,
	shapeType: 'ellipse',
	chartKind: 'pie',
	activeFreeformTool: 'curve',
	freeformTools: ['freeformShape', 'curve'],
};
const GROUPS = [
	'insert.tables',
	'insert.images',
	'insert.illustrations',
	'insert.links',
	'insert.text',
	'insert.symbols',
	'insert.media',
];
const CONTROLS = [
	'insert.tables.table',
	'insert.images.pictures',
	'insert.illustrations.shapes',
	'insert.illustrations.smartArt',
	'insert.illustrations.chart',
	'insert.links.link',
	'insert.links.action',
	'insert.text.textBox',
	'insert.text.field',
	'insert.symbols.equation',
	'insert.media.media',
];

function mount(state: Partial<RibbonInsertState> = {}) {
	const host = document.createElement('pptx-ui-ribbon-insert');
	host.state = { ...STATE, ...state };
	document.body.append(host);
	const requests = vi.fn();
	host.addEventListener('insert-request', (event) => requests((event as CustomEvent).detail));
	return { host, requests };
}
const button = (host: HTMLElement, control: string) =>
	host.querySelector(`[data-ribbon-control="${control}"]`)!.shadowRoot!.querySelector('button')!;

describe('shared Insert view', () => {
	it('exposes every public group and control id exactly once', () => {
		const { host } = mount();
		for (const id of GROUPS) {
			expect(host.querySelectorAll(`[data-ribbon-group="${id}"]`)).toHaveLength(1);
		}
		for (const id of CONTROLS) {
			expect(host.querySelectorAll(`[data-ribbon-control="${id}"]`)).toHaveLength(1);
		}
	});

	it('dispatches one typed intent per command and keeps Link selection-gated', () => {
		const { host, requests } = mount();
		button(host, 'insert.text.textBox').click();
		button(host, 'insert.images.pictures').click();
		expect(requests.mock.calls.map(([detail]) => detail)).toStrictEqual([
			{ kind: 'command', value: 'textBox' },
			{ kind: 'command', value: 'image' },
		]);
		host.state = { ...STATE, hasSelection: false };
		expect(button(host, 'insert.links.link').disabled).toBeTruthy();
		expect(button(host, 'insert.text.textBox').disabled).toBeFalsy();
		button(host, 'insert.links.link').click();
		expect(requests).toHaveBeenCalledTimes(2);
	});

	it('is read-only when not editable and rejects direct requests', () => {
		const { host, requests } = mount({ editable: false });
		expect(button(host, 'insert.tables.table').disabled).toBeTruthy();
		button(host, 'insert.tables.table').click();
		host.querySelector<HTMLElement>('[data-pptx-drawing-tool="curve"]')!.click();
		expect(host.querySelector('select')!.disabled).toBeTruthy();
		expect(host.querySelector<HTMLButtonElement>('.trigger')!.disabled).toBeTruthy();
		expect(requests).not.toHaveBeenCalled();
	});

	it('routes shape and chart pickers through controlled selects', () => {
		const { host, requests } = mount();
		const [shape, chart] = [...host.querySelectorAll('select')];
		expect(shape.value).toBe('ellipse');
		expect(chart.value).toBe('pie');
		shape.value = 'star5';
		shape.dispatchEvent(new Event('change'));
		host
			.querySelector<HTMLButtonElement>(
				'[data-ribbon-control="insert.illustrations.shapes"] .pick',
			)!
			.click();
		host
			.querySelector<HTMLButtonElement>('[data-ribbon-control="insert.illustrations.chart"] .pick')!
			.click();
		expect(requests.mock.calls.map(([detail]) => detail)).toStrictEqual([
			{ kind: 'shapeType', value: 'star5' },
			{ kind: 'shape', value: 'ellipse' },
			{ kind: 'chart', value: 'pie' },
		]);
	});

	it('reflects the armed Freeform tool and toggles it off on a second press', () => {
		const { host, requests } = mount();
		const curve = host.querySelector<HTMLElement>('[data-pptx-drawing-tool="curve"]')!;
		const inner = curve.shadowRoot!.querySelector('button')!;
		expect(inner.getAttribute('aria-pressed')).toBe('true');
		curve.click();
		host.querySelector<HTMLElement>('[data-pptx-drawing-tool="freeformShape"]')!.click();
		expect(requests.mock.calls.map(([detail]) => detail)).toStrictEqual([
			{ kind: 'freeform', value: null },
			{ kind: 'freeform', value: 'freeformShape' },
		]);
		host.state = { ...STATE, freeformTools: ['curve'] };
		expect(
			host.querySelector<HTMLElement>('[data-pptx-drawing-tool="freeformShape"]')!.hidden,
		).toBeTruthy();
	});

	it('opens menus from the keyboard, picks items, closes on Escape and outside press', () => {
		const { host, requests } = mount();
		const action = host.querySelector('[data-ribbon-control="insert.links.action"]')!;
		const trigger = action.querySelector<HTMLButtonElement>('.trigger')!;
		trigger.focus();
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		const items = action.querySelectorAll<HTMLButtonElement>('[role=menuitem]');
		expect(items.length).toBeGreaterThan(5);
		expect(document.activeElement).toBe(items[0]);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(trigger);
		trigger.click();
		items[1].click();
		expect(requests.mock.calls[0][0].kind).toBe('actionButton');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		const field = host.querySelector<HTMLButtonElement>(
			'[data-ribbon-control="insert.text.field"] .trigger',
		)!;
		field.click();
		expect(field.getAttribute('aria-expanded')).toBe('true');
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(field.getAttribute('aria-expanded')).toBe('false');
		field.click();
		host.querySelector<HTMLButtonElement>('[data-insert-item="datetime"]')!.click();
		expect(requests.mock.calls.at(-1)![0]).toStrictEqual({ kind: 'field', value: 'datetime' });
	});

	it('hides unavailable capabilities and keeps independent instances and focus', () => {
		const first = mount();
		const second = mount({
			chartAvailable: false,
			fieldAvailable: false,
			headerFooterAvailable: false,
		});
		expect(
			second.host.querySelector<HTMLElement>('[data-ribbon-control="insert.illustrations.chart"]')!
				.hidden,
		).toBeTruthy();
		expect(
			second.host.querySelector<HTMLElement>('[data-ribbon-control="insert.text.field"]')!.hidden,
		).toBeTruthy();
		expect(
			first.host.querySelector<HTMLElement>('[data-ribbon-control="insert.text.field"]')!.hidden,
		).toBeFalsy();
		const table = button(first.host, 'insert.tables.table');
		table.focus();
		first.host.state = { ...STATE, shapeType: 'star5' };
		expect(button(first.host, 'insert.tables.table')).toBe(table);
		first.host.remove();
		document.body.append(first.host);
		expect(first.host.querySelectorAll('[data-ribbon-control="insert.tables.table"]')).toHaveLength(
			1,
		);
	});

	it('uses translated labels with English fallbacks', () => {
		const { host } = mount({ translate: (key) => (key === 'pptx.ribbon.table' ? 'Tabelle' : key) });
		expect(
			host.querySelector('[data-ribbon-control="insert.tables.table"]')!.getAttribute('label'),
		).toBe('Tabelle');
		expect(
			host.querySelector('[data-ribbon-control="insert.images.pictures"]')!.getAttribute('label'),
		).toBe('Image');
	});
});
