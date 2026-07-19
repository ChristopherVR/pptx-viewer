import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AiFocusBar from './AiFocusBar.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function tableSlide(): PptxSlide {
	return {
		id: 's1',
		slideNumber: 1,
		elements: [
			{ id: 'ppt/slides/slide1.xml-table-1', type: 'table' },
			{ id: 'ppt/slides/slide1.xml-table-2', type: 'table' },
		],
	} as unknown as PptxSlide;
}

function mountBar(
	targets: PptxAiFocusedTarget[],
	handlers: Partial<Record<'onstartpick' | 'onsenddirective', (arg?: never) => void>> = {},
): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(AiFocusBar, {
		target,
		props: {
			targets,
			slides: [tableSlide()],
			isPinned: false,
			hasPicks: false,
			pickMode: false,
			onpin: vi.fn(),
			onclearpin: vi.fn(),
			onsenddirective: handlers.onsenddirective ?? vi.fn(),
			onstartpick: handlers.onstartpick ?? vi.fn(),
			onstoppick: vi.fn(),
			onclearpicks: vi.fn(),
		},
	});
	cleanup = () => unmount(instance);
	return target;
}

describe('aiFocusBar', () => {
	it('renders friendly focus chips for element targets', () => {
		const target = mountBar([
			{ kind: 'element', slideIndex: 0, elementId: 'ppt/slides/slide1.xml-table-1' },
		]);
		const chip = target.querySelector('.pptx-svelte-ai-focus-chip-label')?.textContent ?? '';
		// A short human label ("Table 1"), never the raw id.
		expect(chip).toBe('Table 1');
		expect(target.textContent).not.toContain('slide1.xml');
	});

	it('enters pick mode from the crosshair button', () => {
		const onstartpick = vi.fn();
		const target = mountBar([{ kind: 'slide', slideIndex: 0 }], { onstartpick });
		target.querySelector<HTMLButtonElement>('[aria-pressed="false"]')?.click();
		expect(onstartpick).toHaveBeenCalledOnce();
	});

	it('offers a one-click Merge directive when focus is exactly two tables', () => {
		const onsenddirective = vi.fn();
		const target = mountBar(
			[
				{ kind: 'element', slideIndex: 0, elementId: 'ppt/slides/slide1.xml-table-1' },
				{ kind: 'element', slideIndex: 0, elementId: 'ppt/slides/slide1.xml-table-2' },
			],
			{ onsenddirective },
		);
		const merge = target.querySelector<HTMLButtonElement>('.pptx-svelte-ai-focus-merge');
		expect(merge).not.toBeNull();
		merge?.click();
		expect(onsenddirective).toHaveBeenCalledOnce();
		const directive = onsenddirective.mock.calls[0]?.[0] as string;
		expect(directive).toContain('merge_tables');
		expect(directive).toContain('ppt/slides/slide1.xml-table-1');
		expect(directive).toContain('ppt/slides/slide1.xml-table-2');
	});

	it('hides the Merge directive when the focus is not two tables', () => {
		const target = mountBar([{ kind: 'slide', slideIndex: 0 }]);
		expect(target.querySelector('.pptx-svelte-ai-focus-merge')).toBeNull();
	});
});
