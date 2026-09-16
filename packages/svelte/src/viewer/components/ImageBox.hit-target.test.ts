import type { PptxElement } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ImageBox from './ImageBox.svelte';

/**
 * Issue #285 follow-up: `ElementRenderer` originally only mounted the
 * degenerate-shape hit target overlay on its own text/shape branch. Every
 * type that delegates to its own single-root component (pictures included)
 * never got one, so a sub-MIN_ELEMENT_SIZE picture stayed ungrabbable on the
 * editing canvas. `ImageBox` now renders the same `[data-pptx-hit-target]`
 * overlay, gated by the shared `shouldRenderHitTarget(editable, presenting)`.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

/** A degenerate picture: 400 wide, sub-MIN_ELEMENT_SIZE tall. */
function thinPicture(): PptxElement {
	return {
		type: 'picture',
		id: 'pic-thin',
		x: 0,
		y: 0,
		width: 400,
		height: 1,
		imageData: 'data:image/png;base64,AAAA',
	} as unknown as PptxElement;
}

function render(element: PptxElement, props: Record<string, unknown> = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ImageBox, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 1, ...props },
	});
	flushSync();
	return target;
}

describe('imageBox degenerate hit target (issue #285)', () => {
	it('adds an invisible, bigger hit target only while editable and not presenting', () => {
		const target = render(thinPicture(), { editable: true, presenting: false });
		const hitTarget = target.querySelector<HTMLElement>('[data-pptx-hit-target]');
		expect(hitTarget).not.toBeNull();
		expect(hitTarget?.style.pointerEvents).toBe('auto');
		expect(hitTarget?.style.height).toBe('12px');
	});

	it('never adds the hit target on a read-only (non-editable) render', () => {
		const target = render(thinPicture(), { editable: false, presenting: false });
		expect(target.querySelector('[data-pptx-hit-target]')).toBeNull();
	});

	it('never adds the hit target while presenting', () => {
		const target = render(thinPicture(), { editable: true, presenting: true });
		expect(target.querySelector('[data-pptx-hit-target]')).toBeNull();
	});
});
