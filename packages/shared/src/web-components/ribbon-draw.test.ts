// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());
function mount() {
	const host = document.createElement('pptx-ui-ribbon-draw');
	host.state = {
		tool: 'pen',
		color: '#ff0000',
		width: 5,
		editable: true,
		recentColors: ['#123456'],
	};
	document.body.append(host);
	return host;
}
function tool(host: HTMLElement, name: string) {
	return host
		.querySelector(`[data-ribbon-control="draw.tools.${name}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}
describe('shared Draw view', () => {
	it('keeps all tools and public customization hooks, dispatching one typed intent', () => {
		const host = mount(),
			request = vi.fn();
		host.addEventListener('draw-request', request);
		expect(host.querySelectorAll('pptx-ui-ribbon-command')).toHaveLength(5);
		tool(host, 'freeform').click();
		expect(request).toHaveBeenCalledOnce();
		expect(request.mock.calls[0][0].detail).toStrictEqual({ kind: 'tool', value: 'freeform' });
		expect(host.querySelector('[data-ribbon-control="draw.tools.penColor"]')).toBeTruthy();
		expect(host.querySelector('[data-ribbon-control="draw.tools.penWidth"]')).toBeTruthy();
	});

	it('separates live and committed color picks and includes recent/standard colors', () => {
		const host = mount(),
			request = vi.fn();
		host.addEventListener('draw-request', request);
		const input = host.querySelector<HTMLInputElement>('input[type=color]')!;
		input.value = '#abcdef';
		input.dispatchEvent(new Event('input'));
		input.dispatchEvent(new Event('change'));
		expect(request.mock.calls.map(([event]) => event.detail)).toStrictEqual([
			{ kind: 'color', value: '#abcdef', committed: false },
			{ kind: 'color', value: '#abcdef', committed: true },
		]);
		expect(host.querySelectorAll('.swatch')).toHaveLength(11);
		const colors = host.querySelector('details')!;
		colors.open = true;
		host.querySelector<HTMLButtonElement>('[data-draw-color="#123456"]')!.click();
		expect(colors.open).toBeFalsy();
		expect(document.activeElement).toBe(host.querySelector('summary'));
	});

	it('supports preset and intermediate widths, reflects controlled state and rejects disabled picks', () => {
		const host = mount(),
			request = vi.fn();
		host.addEventListener('draw-request', request);
		const presets = host.querySelector('pptx-ui-select')!;
		expect(presets.value).toBe('5');
		presets.value = '16';
		presets.dispatchEvent(new Event('change'));
		expect(request.mock.calls[0][0].detail).toStrictEqual({ kind: 'width', value: 16 });
		host.state = { ...host.state, width: 16, editable: false };
		expect(presets.disabled).toBeTruthy();
		tool(host, 'pen').click();
		host.querySelector<HTMLButtonElement>('.swatch')!.click();
		expect(request).toHaveBeenCalledOnce();
	});

	it('preserves focus and independent state, cleans up dismissal and reconnects without duplicates', () => {
		const first = mount(),
			second = mount();
		const button = tool(first, 'pen');
		button.focus();
		first.state = { ...first.state, tool: 'highlighter' };
		expect(tool(first, 'pen')).toBe(button);
		expect(document.activeElement).toBe((button.getRootNode() as ShadowRoot).host);
		expect(tool(second, 'pen').getAttribute('aria-pressed')).toBe('true');
		first.querySelector('details')!.open = true;
		first.remove();
		expect(first.querySelector('details')!.open).toBeFalsy();
		document.body.append(first);
		expect(first.querySelectorAll('[data-ribbon-group="draw.tools"]')).toHaveLength(1);
		first.querySelector('details')!.open = true;
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
		expect(first.querySelector('details')!.open).toBeFalsy();
		expect(document.activeElement).toBe(first.querySelector('summary'));
	});
});
