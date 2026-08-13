/**
 * SlideSizeSection tests: the SLIDE SIZE card offers PowerPoint's preset
 * dropdown and Landscape/Portrait toggle, not just the two raw pixel inputs it
 * used to be.
 *
 * The card is a pure view over the shared `resolveSlideSizeSelection`, so these
 * assert the mapping: which option is selected, when "Custom" appears, and the
 * EMU size each control emits.
 */
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18N_CONTEXT_KEY } from '../../../i18n/context';
import SlideSizeSection from './SlideSizeSection.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

interface MountResult {
	target: HTMLElement;
	onupdateslidesize: ReturnType<typeof vi.fn>;
}

function mountCard(
	canvasSize: { width: number; height: number },
	slideSize?: { widthEmu: number; heightEmu: number; type: string },
): MountResult {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onupdateslidesize = vi.fn();
	const instance = mount(SlideSizeSection, {
		target,
		context: new Map<symbol, unknown>([[I18N_CONTEXT_KEY, (key: string) => key]]),
		props: { canvasSize, slideSize, onupdate: vi.fn(), onupdateslidesize },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, onupdateslidesize };
}

const LEDGER = { widthEmu: 12179300, heightEmu: 9134475, type: 'ledger' };

describe('slide size section', () => {
	it('selects the matching preset and marks the deck landscape', () => {
		const { target } = mountCard({ width: 1279, height: 959 }, LEDGER);

		const select = target.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		expect(select.value).toBe('ledger');
		const landscape = target.querySelector<HTMLButtonElement>(
			'[data-pptx-slide-size-orientation="landscape"]',
		)!;
		expect(landscape.getAttribute('aria-pressed')).toBe('true');
	});

	it('offers a Custom entry only for a size no preset matches', () => {
		const custom = mountCard({ width: 800, height: 600 });
		expect(
			custom.target.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!.value,
		).toBe('__custom__');
		cleanup?.();
		cleanup = undefined;

		const preset = mountCard({ width: 1279, height: 959 }, LEDGER);
		const options = Array.from(
			preset.target.querySelectorAll<HTMLOptionElement>('[data-pptx-slide-size-preset] option'),
		).map((option) => option.value);
		expect(options).not.toContain('__custom__');
	});

	it('emits the exact EMU pair for a preset pick and for an orientation flip', () => {
		const { target, onupdateslidesize } = mountCard({ width: 1279, height: 959 }, LEDGER);

		const select = target.querySelector<HTMLSelectElement>('[data-pptx-slide-size-preset]')!;
		select.value = 'a4';
		// Svelte 5 delegates `change` at the mount root, so the event has to bubble.
		select.dispatchEvent(new Event('change', { bubbles: true }));
		expect(onupdateslidesize).toHaveBeenCalledWith({
			widthEmu: 9906000,
			heightEmu: 6858000,
			type: 'A4',
		});

		target
			.querySelector<HTMLButtonElement>('[data-pptx-slide-size-orientation="portrait"]')!
			.click();
		// Portrait swaps cx/cy and keeps the type, exactly as PowerPoint does.
		expect(onupdateslidesize).toHaveBeenLastCalledWith({
			widthEmu: LEDGER.heightEmu,
			heightEmu: LEDGER.widthEmu,
			type: 'ledger',
		});
	});
});
