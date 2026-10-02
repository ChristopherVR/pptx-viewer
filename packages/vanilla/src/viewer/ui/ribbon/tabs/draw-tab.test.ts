import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonDrawHandlers } from '../ribbon-types';
import { createDrawTab } from './draw-tab';

function mount() {
	const handlers: RibbonDrawHandlers = { setTool: vi.fn(), setColor: vi.fn(), setWidth: vi.fn() };
	const tab = createDrawTab(document, createTranslator(), handlers);
	const button = (id: string) =>
		tab.el
			.querySelector(`[data-ribbon-control="draw.tools.${id}"]`)!
			.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
	return { tab, handlers, button };
}
describe('shared Vanilla Draw adapter', () => {
	it('routes every tool exactly once in the canonical order', () => {
		const { tab, handlers, button } = mount();
		for (const name of ['select', 'pen', 'highlighter', 'eraser', 'freeform']) {
			button(name).click();
		}
		expect(tab.el.querySelectorAll('pptx-ui-ribbon-command')).toHaveLength(5);
		expect(vi.mocked(handlers.setTool).mock.calls.flat()).toStrictEqual([
			'select',
			'pen',
			'highlighter',
			'eraser',
			'freeform',
		]);
	});

	it('routes live and committed color changes separately', () => {
		const { tab, handlers } = mount();
		const input = tab.el.querySelector<HTMLInputElement>('input[type=color]')!;
		input.value = '#00ff00';
		input.dispatchEvent(new Event('input'));
		input.dispatchEvent(new Event('change'));
		expect(handlers.setColor).toHaveBeenNthCalledWith(1, '#00ff00', false);
		expect(handlers.setColor).toHaveBeenNthCalledWith(2, '#00ff00', true);
	});

	it('routes 16px width choices to the native handler', () => {
		const { tab, handlers } = mount();
		const select = tab.el.querySelector('pptx-ui-select')!;
		select.value = '16';
		select.dispatchEvent(new Event('change'));
		expect(handlers.setWidth).toHaveBeenCalledExactlyOnceWith(16);
	});

	it('reflects native state without dispatching edits', () => {
		const { tab, handlers, button } = mount();
		tab.update({ tool: 'highlighter', color: '#123456', width: 8, recentColors: ['#112233'] });
		expect(button('highlighter').getAttribute('aria-pressed')).toBe('true');
		expect(tab.el.querySelector('pptx-ui-select')!.value).toBe('8');
		expect(
			tab.el.querySelector('[data-testid="pptx-color-recent"] [data-draw-color="#112233"]'),
		).toBeTruthy();
		expect(handlers.setTool).not.toHaveBeenCalled();
	});

	it('gates read-only controls and restores them', () => {
		const { tab, handlers, button } = mount();
		tab.setEditable(false);
		button('pen').click();
		expect(handlers.setTool).not.toHaveBeenCalled();
		expect(button('pen').disabled).toBeTruthy();
		expect(tab.el.querySelector('pptx-ui-select')!.disabled).toBeTruthy();
		tab.setEditable(true);
		button('pen').click();
		expect(handlers.setTool).toHaveBeenCalledExactlyOnceWith('pen');
	});

	it('keeps two independent host states through remounts', () => {
		const first = mount(),
			second = mount();
		document.body.append(first.tab.el, second.tab.el);
		first.tab.update({ tool: 'eraser', color: '#123456', width: 16 });
		expect(second.button('select').getAttribute('aria-pressed')).toBe('true');
		first.tab.el.remove();
		document.body.append(first.tab.el);
		expect(first.tab.el.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(1);
		first.tab.el.remove();
		second.tab.el.remove();
	});
});
