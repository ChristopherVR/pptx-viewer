import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createActionSection } from './action-section';
import type { InspectorHandlers, InspectorState } from './types';

function build() {
	const setElementAction = vi.fn();
	const section = createActionSection(
		document,
		createTranslator(),
		() => document.createElement('div'),
		{ setElementAction } as unknown as InspectorHandlers,
	);
	return { section, setElementAction };
}

describe('action settings section', () => {
	it('offers React parity action labels', () => {
		const { section } = build();
		section.update({ hasSelection: true } as InspectorState);

		const options = Array.from(section.el.querySelector('select')!.options).map(
			(option) => option.textContent,
		);
		expect(options).toStrictEqual([
			'None',
			'Go to URL',
			'Go to Slide',
			'First Slide',
			'Last Slide',
			'Previous Slide',
			'Next Slide',
			'End Show',
			'Last slide viewed',
			'Custom show',
			'Open file',
			'Open presentation',
			'Play media',
			'Object action',
		]);
	});

	it('waits for a URL before committing a "go to URL" action', () => {
		const { section, setElementAction } = build();
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'url';
		type.dispatchEvent(new Event('change'));
		// An empty URL serialises to an empty action that parses back as "none",
		// which would wipe the choice the user is halfway through making.
		expect(setElementAction).not.toHaveBeenCalled();
		expect(section.el.querySelector<HTMLInputElement>('input')!.hidden).toBeFalsy();

		const target = section.el.querySelector<HTMLInputElement>('input')!;
		target.value = 'https://example.com';
		target.dispatchEvent(new Event('change'));
		expect(setElementAction).toHaveBeenCalledWith('click', {
			trigger: 'click',
			type: 'url',
			url: 'https://example.com',
			slideIndex: undefined,
		});
	});

	it('commits a target-free action immediately', () => {
		const { section, setElementAction } = build();
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'nextSlide';
		type.dispatchEvent(new Event('change'));

		expect(setElementAction).toHaveBeenCalledWith('click', {
			trigger: 'click',
			type: 'nextSlide',
			url: undefined,
			slideIndex: undefined,
		});
	});

	it('reveals the slide spinner before any slide is chosen', () => {
		const { section, setElementAction } = build();
		section.setSlideCount(4);
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'slide';
		type.dispatchEvent(new Event('change'));

		const target = section.el.querySelector<HTMLInputElement>('input')!;
		expect(target.hidden).toBeFalsy();
		expect(target.type).toBe('number');
		expect(setElementAction).not.toHaveBeenCalled();
	});

	it('clamps the slide spinner to the deck slide count', () => {
		const { section, setElementAction } = build();
		section.setSlideCount(3);
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'slide';
		type.dispatchEvent(new Event('change'));
		const target = section.el.querySelector<HTMLInputElement>('input')!;
		expect(target.max).toBe('3');

		target.value = '9';
		target.dispatchEvent(new Event('change'));
		expect(setElementAction).toHaveBeenCalledWith(
			'click',
			expect.objectContaining({ type: 'slide', slideIndex: 2 }),
		);
	});

	// B7: custom-show picker + "return after" checkbox.
	it('waits for a custom show before committing, then commits its id', () => {
		const { section, setElementAction } = build();
		section.setCustomShows([
			{ id: 'sh1', name: 'Highlights' },
			{ id: 'sh2', name: 'Deep dive' },
		]);
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'customShow';
		type.dispatchEvent(new Event('change'));
		expect(setElementAction).not.toHaveBeenCalled();

		const showSelect = section.el.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-action-custom-show"]',
		)!;
		expect(showSelect.hidden).toBeFalsy();
		expect(Array.from(showSelect.options).map((o) => o.textContent)).toStrictEqual([
			'',
			'Highlights',
			'Deep dive',
		]);
		showSelect.value = 'sh2';
		showSelect.dispatchEvent(new Event('change'));

		expect(setElementAction).toHaveBeenCalledWith(
			'click',
			expect.objectContaining({ type: 'customShow', customShowId: 'sh2' }),
		);
	});

	it('commits returnAfter from the checkbox', () => {
		const { section, setElementAction } = build();
		section.setCustomShows([{ id: 'sh1', name: 'Highlights' }]);
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'customShow';
		type.dispatchEvent(new Event('change'));
		const showSelect = section.el.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-action-custom-show"]',
		)!;
		showSelect.value = 'sh1';
		showSelect.dispatchEvent(new Event('change'));

		const returnCheckbox = section.el.querySelector<HTMLInputElement>(
			'[data-testid="pptx-action-custom-show-return"]',
		)!;
		expect(returnCheckbox.closest('[hidden]')).toBeNull();
		returnCheckbox.checked = true;
		returnCheckbox.dispatchEvent(new Event('change'));

		expect(setElementAction).toHaveBeenLastCalledWith(
			'click',
			expect.objectContaining({ type: 'customShow', customShowId: 'sh1', returnAfter: true }),
		);
	});

	it('reflects a committed customShow action back into the picker on update', () => {
		const { section } = build();
		section.setCustomShows([{ id: 'sh1', name: 'Highlights' }]);
		section.update({
			hasSelection: true,
			actionClick: { trigger: 'click', type: 'customShow', customShowId: 'sh1', returnAfter: true },
		} as unknown as InspectorState);

		const showSelect = section.el.querySelector<HTMLSelectElement>(
			'[data-testid="pptx-action-custom-show"]',
		)!;
		const returnCheckbox = section.el.querySelector<HTMLInputElement>(
			'[data-testid="pptx-action-custom-show-return"]',
		)!;
		expect(showSelect.value).toBe('sh1');
		expect(returnCheckbox.checked).toBeTruthy();
	});

	// B7: openFile / openPresentation reuse the same text target field as `url`.
	it('commits a target immediately for openFile (no round-trip-to-none gating)', () => {
		const { section, setElementAction } = build();
		section.update({ hasSelection: true } as InspectorState);

		const [type] = section.el.querySelectorAll<HTMLSelectElement>('select');
		type.value = 'openFile';
		type.dispatchEvent(new Event('change'));

		expect(setElementAction).toHaveBeenCalledWith(
			'click',
			expect.objectContaining({ type: 'openFile', url: '' }),
		);
		const target = section.el.querySelector<HTMLInputElement>('input')!;
		expect(target.hidden).toBeFalsy();

		target.value = 'C:/deck.pptx';
		target.dispatchEvent(new Event('change'));
		expect(setElementAction).toHaveBeenLastCalledWith(
			'click',
			expect.objectContaining({ type: 'openFile', url: 'C:/deck.pptx' }),
		);
	});
});
