import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SlideTemplateGalleryDialog from './SlideTemplateGalleryDialog.svelte';

/**
 * Smoke tests for the Home > Slide Templates gallery dialog markup: the
 * cross-binding DOM contract (dialog name, listbox, 12 option tiles with live
 * previews) plus the select-then-insert flow. The insert wiring itself is
 * covered by the `insertTemplateSlideAfter` op tests.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountDialog(oncancel = vi.fn(), oninsert = vi.fn()) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(SlideTemplateGalleryDialog, {
		target,
		props: { oncancel, oninsert },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, oncancel, oninsert };
}

describe('slideTemplateGalleryDialog', () => {
	it('exposes the dialog/listbox contract with one option per template', () => {
		const { target } = mountDialog();
		const dialog = target.querySelector('[role="dialog"]');
		expect(dialog?.getAttribute('aria-label')).toBe('Slide Templates');
		expect(dialog?.getAttribute('aria-modal')).toBe('true');
		expect(target.querySelector('[role="listbox"]')?.getAttribute('aria-label')).toBe(
			'Slide template gallery',
		);
		const options = target.querySelectorAll('[role="option"]');
		expect(options).toHaveLength(12);
		expect(options[0].getAttribute('aria-label')).toBe('Title Slide');
		expect(options[0].getAttribute('aria-selected')).toBe('false');
		// Each tile carries a live, scaled preview built from the shared catalogue.
		expect(options[0].querySelector('.pptx-svelte-slide-template-preview')).toBeTruthy();
		expect(options[0].querySelector('[data-element-id^="tpl-preview-title-"]')).toBeTruthy();
	});

	it('disables Insert until a tile is selected, then inserts the selection', () => {
		const { target, oninsert } = mountDialog();
		const insertButton = Array.from(
			target.querySelectorAll<HTMLButtonElement>('footer button'),
		).find((button) => button.textContent?.trim() === 'Insert')!;
		expect(insertButton.disabled).toBeTruthy();
		const tile = target.querySelectorAll<HTMLButtonElement>('[role="option"]')[2];
		tile.click();
		flushSync();
		expect(tile.getAttribute('aria-selected')).toBe('true');
		expect(insertButton.disabled).toBeFalsy();
		insertButton.click();
		expect(oninsert).toHaveBeenCalledWith('sectionHeader');
	});

	it('inserts on double click and dismisses via Escape and the backdrop', () => {
		const { target, oncancel, oninsert } = mountDialog();
		const tile = target.querySelectorAll<HTMLButtonElement>('[role="option"]')[0];
		tile.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		expect(oninsert).toHaveBeenCalledWith('title');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(oncancel).toHaveBeenCalledOnce();
		target.querySelector<HTMLButtonElement>('.pptx-svelte-slide-templates-backdrop')?.click();
		expect(oncancel).toHaveBeenCalledTimes(2);
	});
});
