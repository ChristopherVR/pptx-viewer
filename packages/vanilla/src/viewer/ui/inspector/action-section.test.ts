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
});
