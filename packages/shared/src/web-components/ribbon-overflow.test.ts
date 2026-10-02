// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';
import { attachRibbonOverflow, reflowRibbon } from './ribbon-overflow';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const EXPANDED = 200;
const COLLAPSED = 60;

/** jsdom has no layout: model each group as 200px wide, or 60px once collapsed. */
function content(width: number, ids: string[]): HTMLElement {
	const row = document.createElement('div');
	row.dataset.pptxChrome = 'ribbon-content';
	for (const id of ids) {
		const group = document.createElement('div');
		group.dataset.ribbonGroup = id;
		const body = document.createElement('div');
		const button = document.createElement('button');
		button.textContent = `${id} command`;
		body.append(button);
		const caption = document.createElement('span');
		caption.dataset.pptxChrome = 'ribbon-group-label';
		caption.textContent = id.split('.')[1];
		group.append(body, caption);
		group.getBoundingClientRect = () =>
			({
				width: group.hasAttribute('data-collapsed') ? COLLAPSED : EXPANDED,
				height: 90,
				left: 0,
				bottom: 100,
			}) as DOMRect;
		row.append(group);
	}
	Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => width });
	Object.defineProperty(row, 'scrollWidth', {
		configurable: true,
		get: () =>
			[...row.querySelectorAll('[data-ribbon-group]')].reduce(
				(sum, group) => sum + (group.hasAttribute('data-collapsed') ? COLLAPSED : EXPANDED),
				0,
			),
	});
	document.body.append(row);
	return row;
}

const collapsedIds = (row: HTMLElement) =>
	[...row.querySelectorAll('[data-ribbon-group][data-collapsed]')].map(
		(group) => (group as HTMLElement).dataset.ribbonGroup,
	);

describe('ribbon overflow', () => {
	beforeEach(() => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
	});

	it('collapses nothing while every group fits', () => {
		const row = content(1000, ['home.clipboard', 'home.slides', 'home.font']);
		expect(reflowRibbon(row)).toStrictEqual([]);
		expect(collapsedIds(row)).toStrictEqual([]);
		expect(row.querySelector('[data-pptx-chrome="ribbon-collapse"]')).toBeNull();
	});

	it('collapses groups from the right, only as many as needed', () => {
		const row = content(560, ['home.clipboard', 'home.slides', 'home.font', 'home.paragraph']);
		// 4 x 200 = 800 > 560: the last two collapse (200 + 200 + 60 + 60 = 520).
		expect(reflowRibbon(row)).toStrictEqual(['home.paragraph', 'home.font']);
		expect(collapsedIds(row)).toStrictEqual(['home.font', 'home.paragraph']);
		const face = row.querySelector<HTMLElement>(
			'[data-ribbon-group="home.paragraph"] > [data-pptx-chrome="ribbon-collapse"]',
		)!;
		expect(face.textContent).toBe('paragraph');
		expect(face.getAttribute('aria-haspopup')).toBe('true');
		expect(face.getAttribute('aria-expanded')).toBe('false');
	});

	it('restores groups when the row grows again', () => {
		const row = content(400, ['home.clipboard', 'home.slides', 'home.font']);
		reflowRibbon(row);
		expect(collapsedIds(row).length).toBeGreaterThan(0);
		Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => 900 });
		reflowRibbon(row);
		expect(collapsedIds(row)).toStrictEqual([]);
	});

	it('does not collapse on a phone-width window, where the mobile sheet takes over', () => {
		Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
		const row = content(300, ['home.clipboard', 'home.slides']);
		expect(reflowRibbon(row)).toStrictEqual([]);
	});

	it('opens a collapsed group from its face, closes on Escape and on an outside press', async () => {
		vi.useFakeTimers();
		const row = content(260, ['home.clipboard', 'home.slides']);
		const detach = attachRibbonOverflow(row);
		await vi.advanceTimersByTimeAsync(50);
		const group = row.querySelector<HTMLElement>('[data-ribbon-group="home.slides"]')!;
		expect(group.hasAttribute('data-collapsed')).toBeTruthy();
		const face = group.querySelector<HTMLElement>('[data-pptx-chrome="ribbon-collapse"]')!;
		face.click();
		expect(group.hasAttribute('data-open')).toBeTruthy();
		expect(face.getAttribute('aria-expanded')).toBe('true');
		expect(group.style.getPropertyValue('--pptx-collapse-y')).not.toBe('');
		row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(group.hasAttribute('data-open')).toBeFalsy();
		face.click();
		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(group.hasAttribute('data-open')).toBeFalsy();
		detach();
		expect(group.hasAttribute('data-collapsed')).toBeFalsy();
		vi.useRealTimers();
	});

	it('closes the popup after a plain command but keeps it for a control with its own menu', async () => {
		vi.useFakeTimers();
		const row = content(260, ['home.clipboard', 'home.slides']);
		const detach = attachRibbonOverflow(row);
		await vi.advanceTimersByTimeAsync(50);
		const group = row.querySelector<HTMLElement>('[data-ribbon-group="home.slides"]')!;
		const command = group.querySelector<HTMLButtonElement>(':scope > div > button')!;
		const face = group.querySelector<HTMLElement>('[data-pptx-chrome="ribbon-collapse"]')!;
		face.click();
		command.setAttribute('aria-haspopup', 'menu');
		command.click();
		expect(group.hasAttribute('data-open')).toBeTruthy();
		command.removeAttribute('aria-haspopup');
		command.click();
		expect(group.hasAttribute('data-open')).toBeFalsy();
		detach();
		vi.useRealTimers();
	});

	it('gives the shared group an icon and leaves its face to the shadow root', () => {
		const row = document.createElement('div');
		const group = document.createElement('pptx-ui-ribbon-group');
		group.dataset.ribbonGroup = 'insert.tables';
		group.setAttribute('label', 'Tables');
		group.getBoundingClientRect = () =>
			({ width: 200, height: 90, left: 0, bottom: 100 }) as DOMRect;
		row.append(group);
		Object.defineProperty(row, 'clientWidth', { configurable: true, get: () => 100 });
		Object.defineProperty(row, 'scrollWidth', {
			configurable: true,
			get: () => (group.hasAttribute('data-collapsed') ? 60 : 200),
		});
		document.body.append(row);
		expect(reflowRibbon(row)).toStrictEqual(['insert.tables']);
		expect(group.getAttribute('icon')).toBe('table');
		expect(group.querySelector('[data-pptx-chrome="ribbon-collapse"]')).toBeNull();
		const face = group.shadowRoot!.querySelector<HTMLButtonElement>('.face')!;
		expect(face.getAttribute('aria-label')).toBe('Tables');
		const toggled = vi.fn();
		row.addEventListener('ribbon-collapse-toggle', toggled);
		face.click();
		expect(toggled).toHaveBeenCalledOnce();
	});
});
