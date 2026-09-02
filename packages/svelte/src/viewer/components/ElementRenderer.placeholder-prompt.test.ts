import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ElementRenderer from './ElementRenderer.svelte';

/**
 * ElementRenderer placeholder-prompt tests: an empty inherited placeholder's
 * greyed-out authoring hint ("Click to add title", shared
 * `placeholderPromptDescriptor`) must render only on the editing canvas
 * (`editable`), never while presenting, exporting, or in a thumbnail, so the
 * hint never leaks onto the audience screen or a printed handout.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function emptyPlaceholder(promptText: string): PptxElement {
	return {
		type: 'text',
		id: 'title-1',
		x: 10,
		y: 10,
		width: 400,
		height: 80,
		text: '',
		textSegments: [],
		promptText,
	} as unknown as PptxElement;
}

function render(element: PptxElement, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ElementRenderer, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, ...props },
	});
	flushSync();
	const node = target.querySelector<HTMLElement>(`[data-element-id="${element.id}"]`);
	expect(node).not.toBeNull();
	return node as HTMLElement;
}

describe('elementRenderer placeholder prompt', () => {
	it('shows the hint on the editing canvas', () => {
		const node = render(emptyPlaceholder('Click to add title'), { editable: true });
		expect(node.textContent).toContain('Click to add title');
	});

	it('never shows the hint outside edit mode (presenting, export, thumbnail)', () => {
		const presenting = render(emptyPlaceholder('Click to add title'), {
			editable: false,
			presenting: true,
		});
		expect(presenting.textContent).not.toContain('Click to add title');

		const thumbnail = render(emptyPlaceholder('Click to add title'), {
			editable: false,
		});
		expect(thumbnail.textContent).not.toContain('Click to add title');
	});

	it('never shows the hint once the placeholder has real text', () => {
		const withText = {
			...emptyPlaceholder('Click to add title'),
			text: 'My Title',
			textSegments: [{ text: 'My Title', style: {} }],
		} as unknown as PptxElement;
		const node = render(withText, { editable: true });
		expect(node.textContent).not.toContain('Click to add title');
		expect(node.textContent).toContain('My Title');
	});

	it('renders nothing extra for an element with no promptText', () => {
		const node = render(emptyPlaceholder(''), { editable: true });
		expect(node.querySelector('.pptx-svelte-placeholder-prompt')).toBeNull();
	});
});
