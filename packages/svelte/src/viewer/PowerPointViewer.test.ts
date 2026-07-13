import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PowerPointViewer from './PowerPointViewer.svelte';
import type { PowerPointViewerProps } from './types';

/**
 * End-to-end component tests: mount the full viewer against a real `.pptx`
 * fixture and exercise load callbacks, toolbar navigation, thumbnails, and
 * keyboard navigation.
 */

// Vitest runs with cwd = packages/svelte; the fixture lives at the repo root.
const FIXTURE = resolve(process.cwd(), '../../e2e/fixtures/sample-deck.pptx');

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

async function mountViewer(props: Partial<PowerPointViewerProps> = {}): Promise<{
	target: HTMLElement;
	onload: ReturnType<typeof vi.fn>;
	onslidechange: ReturnType<typeof vi.fn>;
}> {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const onload = vi.fn();
	const onslidechange = vi.fn();
	const instance = mount(PowerPointViewer, {
		target,
		props: {
			source: new Uint8Array(readFileSync(FIXTURE)),
			onload,
			onslidechange,
			...props,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	await vi.waitFor(() => expect(onload).toHaveBeenCalledOnce(), { timeout: 15000 });
	flushSync();
	return { target, onload, onslidechange };
}

function toolbarButton(target: HTMLElement, label: string): HTMLButtonElement {
	const button = target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
	if (!button) {
		throw new Error(`Toolbar button not found: ${label}`);
	}
	return button;
}

describe('powerPointViewer', () => {
	it('loads a deck, renders the stage, and reports the slide count', async () => {
		const { target, onload } = await mountViewer();
		const detail = onload.mock.calls[0][0] as { slideCount: number };
		expect(detail.slideCount).toBeGreaterThan(1);
		expect(target.querySelector('.pptx-svelte-stage')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-toolbar')).not.toBeNull();
		expect(target.textContent).toContain(`Slide 1 of ${detail.slideCount}`);
	});

	it('navigates with the toolbar buttons and fires slidechange', async () => {
		const { target, onslidechange } = await mountViewer();
		onslidechange.mockClear();
		toolbarButton(target, 'Next slide').click();
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(1);
		expect(target.textContent).toContain('Slide 2 of');
		toolbarButton(target, 'Previous slide').click();
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(0);
	});

	it('navigates with the keyboard', async () => {
		const { target, onslidechange } = await mountViewer();
		onslidechange.mockClear();
		const root = target.querySelector<HTMLElement>('.pptx-svelte-viewer');
		root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(1);
		root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
		flushSync();
		const last = onslidechange.mock.lastCall?.[0] as number;
		expect(last).toBeGreaterThan(1);
		root?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(0);
	});

	it('honours initialSlide and renders thumbnails for every slide', async () => {
		const { target, onload } = await mountViewer({ initialSlide: 1 });
		const detail = onload.mock.calls[0][0] as { slideCount: number };
		expect(target.textContent).toContain(`Slide 2 of ${detail.slideCount}`);
		const thumbs = target.querySelectorAll('.pptx-svelte-thumb');
		expect(thumbs).toHaveLength(detail.slideCount);
	});

	it('selects a slide from the thumbnail rail', async () => {
		const { target, onslidechange } = await mountViewer();
		onslidechange.mockClear();
		const thumbs = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb');
		thumbs[thumbs.length - 1].click();
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(thumbs.length - 1);
	});

	it('hides chrome when showToolbar/showThumbnails are off', async () => {
		const { target } = await mountViewer({ showToolbar: false, showThumbnails: false });
		expect(target.querySelector('.pptx-svelte-toolbar')).toBeNull();
		expect(target.querySelector('.pptx-svelte-thumbs')).toBeNull();
		expect(target.querySelector('.pptx-svelte-stage')).not.toBeNull();
	});

	it('applies theme overrides as CSS custom properties on the root', async () => {
		const { target } = await mountViewer({
			theme: { colors: { primary: '#ff5533' }, radius: '3px' },
		});
		const root = target.querySelector<HTMLElement>('.pptx-svelte-viewer');
		const style = root?.getAttribute('style') ?? '';
		expect(style).toContain('--pptx-primary: #ff5533');
		expect(style).toContain('--pptx-radius: 3px');
	});

	it('opens the dedicated master and layout navigation workspace', async () => {
		const { target } = await mountViewer({ editable: true });
		const viewTab = [...target.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
			(button) => button.textContent?.trim() === 'View',
		);
		viewTab?.click();
		flushSync();
		toolbarButton(target, 'Edit slide masters and layouts').click();
		flushSync();
		expect(target.querySelector('.pptx-svelte-master-workspace')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-master-canvas .pptx-svelte-stage')).not.toBeNull();
	});

	it('reports load errors through onerror', async () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const onerror = vi.fn();
		const instance = mount(PowerPointViewer, {
			target,
			props: { source: new Uint8Array([9, 9, 9]), onerror },
		});
		flushSync();
		cleanup = () => {
			unmount(instance);
			target.remove();
		};
		await vi.waitFor(() => expect(onerror).toHaveBeenCalledOnce(), { timeout: 15000 });
		flushSync();
		expect(target.querySelector('[role="alert"]')).not.toBeNull();
	});
});
