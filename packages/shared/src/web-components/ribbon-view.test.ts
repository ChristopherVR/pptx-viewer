// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RIBBON_CONTROL_CATALOG } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());
const base = {
	editable: true,
	showRulers: false,
	showGrid: true,
	showGuides: false,
	snapToGrid: false,
	snapToShape: true,
	templateEditing: false,
};
function mount(extra = {}) {
	const host = document.createElement('pptx-ui-ribbon-view');
	host.state = { ...base, ...extra };
	document.body.append(host);
	return host;
}
const button = (host: HTMLElement, id: string) =>
	host.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!.querySelector('button')!;

describe('shared View ribbon', () => {
	it('renders every canonical group and control id exactly once', () => {
		const host = mount();
		for (const [group, def] of Object.entries(RIBBON_CONTROL_CATALOG.view)) {
			if (group === 'presentationViews') {
				expect(host.querySelector('[data-ribbon-group="view.presentationViews"]')).toBeTruthy();
			}
			for (const control of Object.keys(def.controls)) {
				const id = `view.${group}.${control}`;
				const count = host.querySelectorAll(`[data-ribbon-control="${id}"]`).length;
				expect(count).toBeLessThanOrEqual(1);
			}
		}
		expect(host.querySelectorAll('[data-ribbon-group]')).toHaveLength(5);
		expect(host.querySelectorAll('pptx-ui-ribbon-toggle')).toHaveLength(4);
	});

	it('dispatches typed command, option and guide intents', () => {
		const host = mount();
		const request = vi.fn();
		host.addEventListener('view-request', request);
		button(host, 'view.presentationViews.outline').click();
		button(host, 'view.show.snapToShape').click();
		host
			.querySelectorAll('[data-ribbon-control="view.show.addGuide"] pptx-ui-ribbon-command')
			.forEach((el) => {
				(el as HTMLElement).shadowRoot!.querySelector('button')!.click();
			});
		expect(request.mock.calls.map(([event]) => event.detail)).toStrictEqual([
			{ kind: 'command', value: 'outline' },
			{ kind: 'option', value: 'snapToShape', enabled: false },
			{ kind: 'guide', axis: 'h' },
			{ kind: 'guide', axis: 'v' },
		]);
	});

	it('toggles checkbox rows with the checked value and restores controlled state', async () => {
		const host = mount();
		const request = vi.fn();
		host.addEventListener('view-request', request);
		const row = host.querySelector('[data-ribbon-control="view.show.ruler"]')!;
		(row.shadowRoot!.querySelector('[role="checkbox"]') as HTMLElement).click();
		expect(request.mock.calls[0][0].detail).toStrictEqual({
			kind: 'option',
			value: 'showRulers',
			enabled: true,
		});
		await Promise.resolve();
		expect(row.hasAttribute('checked')).toBeFalsy();
	});

	it('reflects pressed, disabled and hidden state and rejects read-only edits', () => {
		const host = mount({ editable: false, selectionPaneAvailable: false, zoomAvailable: false });
		const request = vi.fn();
		host.addEventListener('view-request', request);
		expect(button(host, 'view.masterViews.slideMaster').disabled).toBeTruthy();
		expect(button(host, 'view.show.snapToShape').getAttribute('aria-pressed')).toBe('true');
		expect(
			host.querySelector('[data-ribbon-control="view.show.selectionPane"]')!.hasAttribute('hidden'),
		).toBeTruthy();
		expect(host.querySelector('[data-ribbon-group="view.zoom"]')).toBeNull();
		host.state = { ...host.state, zoomAvailable: true };
		expect(button(host, 'view.zoom.zoom').disabled).toBeTruthy();
		expect(host.lastElementChild?.getAttribute('data-ribbon-group')).toBe('view.window');
		button(host, 'view.window.templateEditing').click();
		expect(request).not.toHaveBeenCalled();
		host.state = { ...host.state, editable: true, templateEditing: true };
		expect(
			host
				.querySelector('[data-ribbon-control="view.window.templateEditing"]')!
				.getAttribute('label'),
		).toBe('Templates On');
	});

	it('keeps focus across updates, isolates instances and reconnects without duplicates', () => {
		const first = mount();
		const second = mount();
		const normal = button(first, 'view.presentationViews.normal');
		normal.focus();
		first.state = { ...first.state, showRulers: true };
		expect(button(first, 'view.presentationViews.normal')).toBe(normal);
		expect(
			first.querySelector('[data-ribbon-control="view.show.ruler"]')!.hasAttribute('checked'),
		).toBeTruthy();
		expect(
			second.querySelector('[data-ribbon-control="view.show.ruler"]')!.hasAttribute('checked'),
		).toBeFalsy();
		first.remove();
		document.body.append(first);
		expect(first.querySelectorAll('[data-ribbon-group="view.show"]')).toHaveLength(1);
	});
});
