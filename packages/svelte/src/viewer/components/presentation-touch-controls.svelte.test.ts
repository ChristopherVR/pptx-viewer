import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PresentationTouchControls from './PresentationTouchControls.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountControls(current: number, total: number) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const callbacks = { onprev: vi.fn(), onnext: vi.fn(), onexit: vi.fn() };
	const instance = mount(PresentationTouchControls, {
		target,
		props: { current, total, ...callbacks },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, ...callbacks };
}

describe('presentationTouchControls', () => {
	it('reflects slide boundaries and exposes an exit action', () => {
		const { target, onexit } = mountControls(0, 2);
		expect(
			target.querySelector<HTMLButtonElement>('.pptx-svelte-presentation-touch-prev')?.disabled,
		).toBeTruthy();
		expect(
			target.querySelector<HTMLButtonElement>('.pptx-svelte-presentation-touch-next')?.disabled,
		).toBeFalsy();
		expect(
			target.querySelector('.pptx-svelte-presentation-touch-counter')?.textContent?.trim(),
		).toBe('1 / 2');

		target.querySelector<HTMLButtonElement>('.pptx-svelte-presentation-touch-exit')?.click();
		expect(onexit).toHaveBeenCalledOnce();
	});

	it('routes previous and next taps without bubbling to slide advance', () => {
		const { target, onprev, onnext } = mountControls(1, 3);
		const bubbled = vi.fn();
		document.body.addEventListener('click', bubbled);

		target.querySelector<HTMLButtonElement>('.pptx-svelte-presentation-touch-prev')?.click();
		target.querySelector<HTMLButtonElement>('.pptx-svelte-presentation-touch-next')?.click();

		expect(onprev).toHaveBeenCalledOnce();
		expect(onnext).toHaveBeenCalledOnce();
		expect(bubbled).not.toHaveBeenCalled();
		document.body.removeEventListener('click', bubbled);
	});
});
