import type { PptxSlide } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ReviewTab from './ReviewTab.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function slide(elements: PptxSlide['elements']): PptxSlide {
	return { id: 'slide-1', elements } as PptxSlide;
}

describe('reviewTab', () => {
	it('toggles live spell checking from the Review ribbon', () => {
		const target = document.createElement('div');
		const onspellcheckchange = vi.fn();
		const instance = mount(ReviewTab, { target, props: { slides: [], onnavigate: vi.fn(), spellCheck: false, onspellcheckchange } });
		cleanup = () => unmount(instance);
		const spell = [...target.querySelectorAll('button')].find((button) => button.textContent?.includes('Spell')) as HTMLButtonElement;
		spell.click();
		expect(onspellcheckchange).toHaveBeenCalledWith(true);
	});

	it('runs the shared audit and routes an issue to its slide', () => {
		const target = document.createElement('div');
		const onnavigate = vi.fn();
		const instance = mount(ReviewTab, {
			target,
			props: {
				slides: [
					slide([
						{
							type: 'image',
							id: 'image-1',
							x: 0,
							y: 0,
							width: 100,
							height: 100,
							imagePath: 'ppt/media/image1.png',
						},
					]),
				],
				onnavigate,
			},
		});
		cleanup = () => unmount(instance);

		const accessibilityButton = [...target.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Check Accessibility'),
		) as HTMLButtonElement;
		accessibilityButton.click();
		flushSync();
		(target.querySelector('.pptx-svelte-review-heading button') as HTMLButtonElement).click();
		flushSync();

		expect(target.textContent).toContain('Missing alt text');
		const issue = target.querySelector('.pptx-svelte-review-issue') as HTMLButtonElement;
		issue.click();
		expect(onnavigate).toHaveBeenCalledWith(0, 'image-1');
	});

	it('reports a clean presentation after a check', () => {
		const target = document.createElement('div');
		const instance = mount(ReviewTab, {
			target,
			props: {
				slides: [
					slide([
						{
							type: 'text',
							id: 'title-1',
							x: 0,
							y: 0,
							width: 100,
							height: 20,
							text: 'Accessible title',
							textStyle: {},
						},
					]),
				],
				onnavigate: vi.fn(),
			},
		});
		cleanup = () => unmount(instance);

		const accessibilityButton = [...target.querySelectorAll('button')].find((button) =>
			button.textContent?.includes('Check Accessibility'),
		) as HTMLButtonElement;
		accessibilityButton.click();
		flushSync();
		(target.querySelector('.pptx-svelte-review-heading button') as HTMLButtonElement).click();
		flushSync();

		expect(target.textContent).toContain('No issues found');
	});
});
