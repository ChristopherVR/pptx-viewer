import type { PptxElement } from 'pptx-viewer-core';
import type { SanitizedPresence } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import RemoteSelectionOverlay from './RemoteSelectionOverlay.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function buildElement(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
): PptxElement {
	return { id, type: 'shape', x, y, width, height } as PptxElement;
}

function buildPresence(overrides: Partial<SanitizedPresence> = {}): SanitizedPresence {
	return {
		clientId: 1,
		userName: 'Ada',
		userColor: '#ff0000',
		activeSlideIndex: 0,
		cursorX: 0,
		cursorY: 0,
		lastUpdated: new Date().toISOString(),
		selectedElementId: 'el1',
		...overrides,
	};
}

const elements = [buildElement('el1', 40, 30, 200, 100), buildElement('el2', 300, 200, 50, 50)];

function mountOverlay(props: {
	presences: SanitizedPresence[];
	activeSlideIndex?: number;
	zoom?: number;
}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(RemoteSelectionOverlay, {
		target,
		props: {
			presences: props.presences,
			elements,
			activeSlideIndex: props.activeSlideIndex ?? 0,
			zoom: props.zoom ?? 1,
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function boxes(target: HTMLElement): HTMLElement[] {
	return Array.from(target.querySelectorAll<HTMLElement>('.pptx-svelte-remote-selection'));
}

describe('remoteSelectionOverlay', () => {
	it('draws one box per remote selection on the active slide, scaled and coloured', () => {
		const target = mountOverlay({ presences: [buildPresence()], zoom: 2 });

		const drawn = boxes(target);
		expect(drawn).toHaveLength(1);
		expect(drawn[0].dataset.selectionKey).toBe('1-el1');
		expect(drawn[0].style.transform).toBe('translate(80px, 60px)');
		expect(drawn[0].style.width).toBe('400px');
		expect(drawn[0].style.height).toBe('200px');
		expect(drawn[0].style.borderColor).toBe('#ff0000');
	});

	it('labels each box with the peer name (truncated) on the peer colour', () => {
		const target = mountOverlay({
			presences: [buildPresence({ userName: 'An Extremely Long Collaborator Name' })],
		});

		const label = target.querySelector<HTMLElement>('.pptx-svelte-remote-selection-label');
		expect(label).not.toBeNull();
		expect(label?.textContent?.trim()).toBe('An Extremely Long...');
		expect(label?.style.backgroundColor).toBe('#ff0000');
	});

	it('skips peers on other slides, without a selection, or with unresolvable ids', () => {
		const target = mountOverlay({
			presences: [
				buildPresence({ clientId: 1, activeSlideIndex: 3 }),
				buildPresence({ clientId: 2, selectedElementId: undefined }),
				buildPresence({ clientId: 3, selectedElementId: 'nope' }),
			],
		});
		expect(boxes(target)).toHaveLength(0);
	});

	it('draws each peer selection that resolves, keyed by peer and element', () => {
		const target = mountOverlay({
			presences: [
				buildPresence({ clientId: 1 }),
				buildPresence({ clientId: 2, userColor: '#22c55e', selectedElementId: 'el2' }),
			],
		});
		const drawn = boxes(target);
		expect(drawn).toHaveLength(2);
		expect(drawn.map((box) => box.dataset.selectionKey)).toStrictEqual(['1-el1', '2-el2']);
		expect(drawn[1].style.borderColor).toBe('#22c55e');
	});

	it('never intercepts stage input (aria-hidden + export-ignore host)', () => {
		const target = mountOverlay({ presences: [buildPresence()] });
		const host = target.querySelector<HTMLElement>('.pptx-svelte-remote-selections');
		expect(host?.getAttribute('aria-hidden')).toBe('true');
		expect(host?.dataset.exportIgnore).toBe('true');
	});
});
