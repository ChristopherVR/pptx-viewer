import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlideShowTab from './SlideShowTab.svelte';

/**
 * SlideShowTab tests: the tab has to offer React's whole Slide Show control set
 * (Start / Present / Set Up / Options), with the same commands live and the
 * same ones parked, or a user who switches bindings loses buttons.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountTab(overrides: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	const noop = vi.fn();
	const instance = mount(SlideShowTab, {
		target,
		props: {
			onfrombeginning: noop,
			onfromcurrent: noop,
			onpresenter: noop,
			onsetup: noop,
			onrehearse: noop,
			onsubtitles: noop,
			oncustomshows: noop,
			onhideslide: noop,
			...overrides,
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

function buttons(target: HTMLElement): Map<string, HTMLButtonElement> {
	return new Map(
		[...target.querySelectorAll<HTMLButtonElement>('button')].map((button) => [
			button.textContent?.trim() ?? '',
			button,
		]),
	);
}

function toggle(target: HTMLElement, label: string): HTMLInputElement | undefined {
	return [...target.querySelectorAll('label')]
		.find((node) => node.textContent?.trim() === label)
		?.querySelector('input') as HTMLInputElement | undefined;
}

describe('slideShowTab', () => {
	it('offers the live Start / Present / Set Up commands', () => {
		const found = buttons(mountTab());
		for (const name of [
			'From Beginning',
			'From Current Slide',
			'Presenter View',
			'Set Up Slide Show',
			'Rehearse Timings',
			'Record',
			'Subtitle Settings',
			'Custom show',
		]) {
			expect(found.get(name), `${name} is missing from the Slide Show tab`).toBeDefined();
			expect(found.get(name)?.disabled, `${name} should be usable`).toBeFalsy();
		}
	});

	it('parks Rehearse Coach exactly as React does', () => {
		const found = buttons(mountTab());
		expect(found.get('Rehearse with Coach')).toBeDefined();
		expect(found.get('Rehearse with Coach')?.disabled).toBeTruthy();
	});

	it('toggles the active slide with Hide Slide and reflects its pressed state', () => {
		const onhideslide = vi.fn();
		const target = mountTab({ onhideslide, activeSlideHidden: true });
		const button = buttons(target).get('Hide Slide');
		expect(button).toBeDefined();
		expect(button?.disabled).toBeFalsy();
		// PowerPoint renders Hide Slide as a two-state toggle, not a one-shot.
		expect(button?.getAttribute('aria-pressed')).toBe('true');
		button?.click();
		expect(onhideslide).toHaveBeenCalledOnce();
	});

	it('offers the playback option toggles', () => {
		const target = mountTab();
		expect(toggle(target, 'Keep Slides Updated')?.disabled).toBeTruthy();
		expect(toggle(target, 'Using timings, if present')?.checked).toBeTruthy();
		expect(toggle(target, 'Play Narrations')?.checked).toBeTruthy();
		expect(toggle(target, 'Show Media Controls')?.checked).toBeTruthy();
	});

	it('reflects and toggles the host subtitle flag', () => {
		const onsubtitles = vi.fn();
		const target = mountTab({ onsubtitles, subtitlesEnabled: true });

		const subtitles = toggle(target, 'Subtitles');
		expect(subtitles?.checked).toBeTruthy();
		// Dispatched rather than `.click()`: jsdom's checkbox activation does not
		// reach Svelte's delegated `change` listener.
		subtitles!.checked = false;
		subtitles!.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onsubtitles).toHaveBeenCalledOnce();
	});

	it('hides Broadcast when the host has not wired it', () => {
		expect(buttons(mountTab()).has('Broadcast')).toBeFalsy();
		expect(buttons(mountTab({ onbroadcast: vi.fn() })).has('Broadcast')).toBeTruthy();
	});
});
