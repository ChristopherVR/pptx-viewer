import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MobileChrome from './MobileChrome.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function renderMobileChrome(hiddenActions?: string[]) {
	const target = document.createElement('div');
	const instance = mount(MobileChrome, {
		target,
		props: {
			editable: true,
			canUndo: true,
			canRedo: true,
			onmenu: vi.fn(),
			onundo: vi.fn(),
			onredo: vi.fn(),
			onsave: vi.fn(),
			onpresent: vi.fn(),
			onshare: vi.fn(),
			...(hiddenActions ? { hiddenActions } : {}),
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

describe('mobileChrome hiddenActions', () => {
	it('renders Undo, Redo, Present, and Share when hiddenActions is omitted (backward compatible default)', () => {
		const target = renderMobileChrome();

		expect(target.querySelector('[aria-label="Undo"]')).not.toBeNull();
		expect(target.querySelector('[aria-label="Redo"]')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-mobile-present')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-mobile-share')).not.toBeNull();
	});

	it('hides Share when "share" is in hiddenActions', () => {
		const target = renderMobileChrome(['share']);

		expect(target.querySelector('.pptx-svelte-mobile-share')).toBeNull();
	});

	it('hides Undo/Redo individually when listed in hiddenActions', () => {
		const target = renderMobileChrome(['undo', 'redo']);

		expect(target.querySelector('[aria-label="Undo"]')).toBeNull();
		expect(target.querySelector('[aria-label="Redo"]')).toBeNull();
	});

	it('hides the Present (fullscreen) button when "fullscreen" is in hiddenActions', () => {
		const target = renderMobileChrome(['fullscreen']);

		expect(target.querySelector('.pptx-svelte-mobile-present')).toBeNull();
	});
});
