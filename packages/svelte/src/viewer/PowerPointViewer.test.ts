import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { ExternalCollaborationSession } from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

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
	instance: { canUndo(): boolean };
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
			get editable() {
				return props.editable;
			},
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	await vi.waitFor(() => expect(onload).toHaveBeenCalledOnce(), { timeout: 15000 });
	flushSync();
	return { target, onload, onslidechange, instance };
}

describe('powerPointViewer', () => {
	it.each(['sync loss', 'host veto', 'host veto during composition'])(
		'retains an accepted draft on %s and cannot overwrite resumed remote text',
		async (transition) => {
			const doc = new Y.Doc();
			const permission = new SvelteMap([['editable', true]]);
			let synced = true;
			const listeners = new Set<() => void>();
			const externalSession: ExternalCollaborationSession = {
				doc,
				awareness: {
					clientID: doc.clientID,
					getLocalState: () => null,
					setLocalState: () => {},
					setLocalStateField: () => {},
					getStates: () => new Map(),
					on: () => {},
					off: () => {},
				},
				getSnapshot: () => ({ status: 'connected', synced }),
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
			};
			try {
				const { target, instance } = await mountViewer({
					get editable() {
						return permission.get('editable');
					},
					collaboration: { roomId: 'external', serverUrl: '', userName: 'Writer', externalSession },
				});
				await vi.waitFor(() => expect(readSlidesFromYDoc(doc).length).toBeGreaterThan(0));
				flushSync();
				expect(
					target
						.querySelector('.pptx-svelte-stage-holder')
						?.classList.contains('pptx-svelte-editing'),
				).toBeTruthy();
				const text = readSlidesFromYDoc(doc)[0].elements.find(
					(element) => 'text' in element && element.text === 'Product Overview',
				)!;
				const stage = target.querySelector<HTMLElement>('.pptx-svelte-stage-holder')!;
				const shape = stage.querySelector<HTMLElement>(`[data-element-id="${text.id}"]`)!;
				shape.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
				flushSync();
				const draftNode = target.querySelector<HTMLElement>('[data-inline-editor]')!;
				expect(draftNode).not.toBeNull();
				const body = draftNode.querySelector('[data-pptx-list-run]')!.firstChild as Text;
				window.getSelection()!.setBaseAndExtent(body, 0, body, body.length);
				draftNode.dispatchEvent(
					new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText' }),
				);
				body.data = 'Accepted draft';
				draftNode.dispatchEvent(
					new InputEvent('input', { bubbles: true, inputType: 'insertText' }),
				);
				if (transition === 'host veto during composition') {
					draftNode.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
					body.data += 'UNACCEPTED';
				}
				const updates = vi.fn();
				doc.on('update', updates);
				if (transition === 'sync loss') {
					synced = false;
					for (const listener of listeners) listener();
				} else {
					permission.set('editable', false);
				}
				flushSync();
				expect(target.querySelector('[data-inline-editor]')).toBeNull();
				expect(stage.textContent).toContain('Accepted draft');
				expect(stage.textContent).not.toContain('UNACCEPTED');
				expect(updates).not.toHaveBeenCalled();
				expect(instance.canUndo()).toBeFalsy();
				const remote = readSlidesFromYDoc(doc);
				Object.assign(
					remote[0].elements.find((element) => element.id === text.id)!,
					{ text: 'Remote replacement', textSegments: [{ text: 'Remote replacement', style: {} }] },
				);
				reconcileSlidesInYDoc(
					remote,
					doc,
					{
						createMap: () => new Y.Map(),
						createArray: () => new Y.Array(),
						createText: () => new Y.Text(),
					},
					'peer',
				);
				synced = true;
				for (const listener of listeners) {
					listener();
				}
				if (transition !== 'sync loss') permission.set('editable', true);
				flushSync();
				draftNode.dispatchEvent(new FocusEvent('blur'));
				flushSync();
				expect(stage.textContent).toContain('Remote replacement');
				expect(stage.textContent).not.toContain('Accepted draft');
			} finally {
				cleanup?.();
				cleanup = undefined;
				doc.destroy();
			}
		},
	);

	it('loads a deck, renders the stage, and reports the slide count', async () => {
		const { target, onload } = await mountViewer();
		const detail = onload.mock.calls[0][0] as { slideCount: number };
		expect(detail.slideCount).toBeGreaterThan(1);
		expect(target.querySelector('.pptx-svelte-stage')).not.toBeNull();
		// Read-only decks now render the full ribbon (React parity), not the
		// lean fallback toolbar.
		expect(target.querySelector('.pptx-svelte-ribbon')).not.toBeNull();
		expect(target.textContent).toContain(`Slide 1 of ${detail.slideCount}`);
	});

	it('keeps the slide counter in the status bar when editing', async () => {
		const { target, onload } = await mountViewer({ editable: true });
		const detail = onload.mock.calls[0][0] as { slideCount: number };
		expect(target.querySelector('.pptx-svelte-ribbon-nav')).toBeNull();
		expect(target.querySelector('.pptx-svelte-statusbar')?.textContent).toContain(
			`Slide 1 of ${detail.slideCount}`,
		);
		expect(target.querySelector('.pptx-svelte-statusbar [aria-label="Previous slide"]')).toBeNull();
		expect(target.querySelector('.pptx-svelte-statusbar [aria-label="Share"]')).toBeNull();
		const mobileToolbar = target.querySelector('.pptx-svelte-mobile-toolbar');
		expect(
			Array.from(mobileToolbar?.querySelectorAll('button') ?? []).map((button) =>
				button.getAttribute('aria-label'),
			),
		).toStrictEqual(['Menu', 'Undo', 'Redo', 'Save', 'Present', 'Share']);
		const mobileActions = target.querySelector('.pptx-svelte-mobile-actions nav');
		expect(
			Array.from(mobileActions?.querySelectorAll('small') ?? []).map((item) => item.textContent),
		).toStrictEqual(['Slides', 'Insert', 'Format', 'Comments', 'Notes']);
	});

	it('navigates via the thumbnail rail and fires slidechange', async () => {
		// Read-only chrome no longer carries prev/next buttons (React parity:
		// navigation is via thumbnails / keyboard), so drive nav from the rail.
		const { target, onslidechange } = await mountViewer();
		onslidechange.mockClear();
		const thumbs = target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-thumb');
		thumbs[1].click();
		flushSync();
		expect(onslidechange).toHaveBeenLastCalledWith(1);
		expect(target.textContent).toContain('Slide 2 of');
		thumbs[0].click();
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
		const viewTab = [...target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-ribbon-tab')].find(
			(button) => button.textContent?.trim() === 'View',
		);
		viewTab?.click();
		flushSync();
		// Accessible name is the visible "Slide Master" text (cross-binding e2e
		// contract); the tooltip lives on title only.
		const slideMasterButton = [...target.querySelectorAll<HTMLButtonElement>('button')].find(
			(button) => button.textContent?.trim() === 'Slide Master',
		);
		if (!slideMasterButton) {
			throw new Error('Slide Master button not found');
		}
		slideMasterButton.click();
		flushSync();
		expect(target.querySelector('.pptx-svelte-master-workspace')).not.toBeNull();
		expect(target.querySelector('.pptx-svelte-master-canvas .pptx-svelte-stage')).not.toBeNull();
	});

	/**
	 * File > Open > "Browse this device" was inert: the backstage received the
	 * optional `onopenfile` host prop straight through, so with no host handler
	 * (the demos, and the default for any embedder) clicking it did nothing at
	 * all, while React/Vue/Angular/Vanilla fall back to the shared
	 * `openPptxFile()` picker. The fallback creates a transient
	 * `<input type="file">` and clicks it, which is what this asserts.
	 */
	it('opens a native file picker from File > Open > Browse this device', async () => {
		const { target } = await mountViewer({ editable: true });
		const clicked: HTMLInputElement[] = [];
		const realClick = HTMLInputElement.prototype.click;
		vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(
			function (this: HTMLInputElement) {
				if (this.type === 'file') {
					clicked.push(this);
					return;
				}
				realClick.call(this);
			},
		);

		const byText = (text: string): HTMLButtonElement | undefined =>
			[...target.querySelectorAll<HTMLButtonElement>('button')].find(
				(button) => button.textContent?.trim() === text,
			);

		[...target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-ribbon-tab')]
			.find((button) => button.textContent?.trim() === 'File')
			?.click();
		flushSync();
		byText('Open')?.click();
		flushSync();
		const browse = byText('Browse this device');
		expect(browse, 'the Open pane has no Browse control').toBeDefined();
		browse?.click();
		flushSync();

		expect(clicked).toHaveLength(1);
		expect(clicked[0].accept).toContain('.pptx');
	});

	/**
	 * The backstage is a full-screen `position: fixed` overlay, so it must not
	 * live inside the ribbon's content row: that row styles every direct child
	 * with `align-items: flex-start`, which stopped the backstage nav rail
	 * stretching and left a short stub column floating at the top of the window.
	 */
	it('renders the File backstage outside the ribbon content row', async () => {
		const { target } = await mountViewer({ editable: true });
		[...target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-ribbon-tab')]
			.find((button) => button.textContent?.trim() === 'File')
			?.click();
		flushSync();

		const backstage = target.querySelector('[role="dialog"][aria-label="File"]');
		expect(backstage).not.toBeNull();
		expect(backstage?.closest('.pptx-svelte-ribbon-content')).toBeNull();
		// ...and the rail's bottom group is separated by the flex spacer that a
		// non-stretched rail collapses.
		expect(backstage?.querySelector('aside nav i')).not.toBeNull();
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
