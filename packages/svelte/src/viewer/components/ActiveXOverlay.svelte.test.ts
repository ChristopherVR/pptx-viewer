import type { PptxActiveXControl } from 'pptx-viewer-core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ActiveXOverlay from './ActiveXOverlay.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountOverlay(controls: readonly PptxActiveXControl[]): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(ActiveXOverlay, {
		target,
		props: { controls, canvasSize: { width: 1280, height: 720 } },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

describe('activeXOverlay', () => {
	it('carries the pptx-activex-overlay testid on its container', () => {
		const target = mountOverlay([{ relId: 'rId9', name: 'CommandButton1' }]);
		expect(target.querySelector('[data-testid="pptx-activex-overlay"]')).not.toBeNull();
	});

	it('draws a labelled placeholder badge for a control with no fallback picture', () => {
		const target = mountOverlay([{ relId: 'rId9', name: 'CommandButton1' }]);

		const badge = target.querySelector('.pptx-svelte-activex-overlay-placeholder') as HTMLElement;
		expect(badge).not.toBeNull();
		expect(badge.textContent).toBe('CommandButton1');
		expect(target.querySelector('img')).toBeNull();
	});

	it('falls back to a generic label when the control has none', () => {
		const target = mountOverlay([{ relId: 'rId9' }]);
		expect(target.querySelector('.pptx-svelte-activex-overlay-placeholder')?.textContent).toBe(
			'ActiveX control',
		);
	});

	it('stacks multiple geometry-less controls instead of drawing them on top of each other', () => {
		const target = mountOverlay([
			{ relId: 'rId1', name: 'A' },
			{ relId: 'rId2', name: 'B' },
		]);

		const badges = Array.from(
			target.querySelectorAll<HTMLElement>('.pptx-svelte-activex-overlay-placeholder'),
		);
		expect(badges).toHaveLength(2);
		expect(badges[0]?.style.top).not.toBe(badges[1]?.style.top);
	});
});
