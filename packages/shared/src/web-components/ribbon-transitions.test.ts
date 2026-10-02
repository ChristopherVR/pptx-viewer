// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { EMPTY_RIBBON_TRANSITION_DRAFT } from '../render';
import type { RibbonTransitionsViewState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const base: RibbonTransitionsViewState = {
	draft: { ...EMPTY_RIBBON_TRANSITION_DRAFT, type: 'fade', advanceAfter: true },
	editable: true,
};
function mount(state: Partial<RibbonTransitionsViewState> = {}) {
	const host = document.createElement('pptx-ui-ribbon-transitions');
	host.state = { ...base, ...state };
	document.body.append(host);
	const requests = vi.fn<(event: Event) => void>();
	host.addEventListener('transitions-request', requests);
	return {
		host,
		details: () => requests.mock.calls.map(([event]) => (event as CustomEvent).detail),
	};
}
const inner = (host: HTMLElement, id: string) =>
	host.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!.querySelector('button')!;

describe('shared Transitions view', () => {
	it('keeps every public group and control id once', () => {
		const { host } = mount();
		for (const id of ['preview', 'transitionToThisSlide', 'timing']) {
			expect(host.querySelectorAll(`[data-ribbon-group="transitions.${id}"]`)).toHaveLength(1);
		}
		for (const id of [
			'preview.preview',
			'transitionToThisSlide.gallery',
			'timing.sound',
			'timing.duration',
			'timing.applyToAll',
			'timing.advanceOnClick',
			'timing.advanceAfter',
		]) {
			expect(host.querySelectorAll(`[data-ribbon-control="transitions.${id}"]`)).toHaveLength(1);
		}
		expect(host.querySelectorAll('.preset')).toHaveLength(9);
	});

	it('reflects the draft as pressed state and dispatches typed intents', () => {
		const { host, details } = mount();
		const presets = [...host.querySelectorAll<HTMLButtonElement>('.preset')];
		const pressed = presets.filter((p) => p.getAttribute('aria-pressed') === 'true');
		expect(pressed.map((p) => p.textContent)).toStrictEqual(['Fade']);
		presets.find((p) => p.textContent === 'Wipe')!.click();
		inner(host, 'transitions.timing.applyToAll').click();
		inner(host, 'transitions.preview.preview').click();
		const duration = host.querySelector<HTMLInputElement>('input[type=number]')!;
		duration.value = '25';
		duration.dispatchEvent(new Event('input'));
		duration.value = '1.5';
		duration.dispatchEvent(new Event('input'));
		expect(details()).toStrictEqual([
			{ kind: 'preset', value: 'wipe' },
			{ kind: 'applyToAll' },
			{ kind: 'preview' },
			{ kind: 'duration', value: 20 },
			{ kind: 'duration', value: 1.5 },
		]);
	});

	it('commits the After text on change only and gates it on the After checkbox', () => {
		const { host, details } = mount();
		const text = host.querySelector<HTMLInputElement>('input[type=text]')!;
		text.value = '00:03.00';
		text.dispatchEvent(new Event('input'));
		expect(details()).toHaveLength(0);
		text.dispatchEvent(new Event('change'));
		expect(details()).toStrictEqual([{ kind: 'advanceAfterText', value: '00:03.00' }]);
		host.state = { ...base, draft: { ...base.draft, advanceAfter: false } };
		expect(text.disabled).toBeTruthy();
	});

	it('lists sound options, handles stock sounds and routes Other Sound to the file input', () => {
		const { host, details } = mount();
		const select = host.querySelector<HTMLSelectElement>('pptx-ui-select')!;
		expect(select.value).toBe('none');
		select.value = 'other';
		const picker = vi.spyOn(host.querySelector<HTMLInputElement>('input[type=file]')!, 'click');
		select.dispatchEvent(new Event('change'));
		expect(picker).toHaveBeenCalledOnce();
		expect(select.value).toBe('none');
		expect(details()).toHaveLength(0);
		const stock = [...select.options].find((o) => !['none', 'other'].includes(o.value))!;
		select.value = stock.value;
		select.dispatchEvent(new Event('change'));
		expect(details()).toStrictEqual([{ kind: 'sound', value: stock.value }]);
	});

	it('rejects edits when read-only but still allows Preview and the Inspector toggle', () => {
		const { host, details } = mount({ editable: false });
		host.querySelector<HTMLButtonElement>('.preset')!.click();
		inner(host, 'transitions.timing.applyToAll').click();
		inner(host, 'transitions.preview.preview').click();
		host.querySelector('.inspector')!.shadowRoot!.querySelector('button')!.click();
		expect(details()).toStrictEqual([{ kind: 'preview' }, { kind: 'inspector' }]);
		expect(host.querySelector<HTMLInputElement>('input[type=number]')!.disabled).toBeTruthy();
	});

	it('preserves focused controls, isolates instances and reflects Inspector state', () => {
		const first = mount().host;
		const second = mount().host;
		const button = first.querySelectorAll<HTMLButtonElement>('.preset')[2];
		button.focus();
		first.state = { ...base, draft: { ...base.draft, type: 'push' }, inspectorOpen: true };
		expect(first.querySelectorAll<HTMLButtonElement>('.preset')[2]).toBe(button);
		expect(document.activeElement).toBe(button);
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(second.querySelectorAll('.preset')[2].getAttribute('aria-pressed')).toBe('false');
		expect(first.querySelector('.inspector')!.getAttribute('pressed')).toBe('true');
		first.remove();
		document.body.append(first);
		expect(first.querySelectorAll('[data-ribbon-group="transitions.timing"]')).toHaveLength(1);
	});
});
