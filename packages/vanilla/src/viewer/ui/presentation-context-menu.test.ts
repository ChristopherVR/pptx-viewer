import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { ViewerState } from '../state';
import { mountPresentationContextMenu } from './presentation-context-menu';

const t = createTranslator('en');

function harness(options: { presenting?: boolean; shouldShow?: () => boolean } = {}) {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		presenting: options.presenting ?? true,
	});
	const root = document.createElement('div');
	document.body.appendChild(root);
	const callbacks = {
		next: vi.fn(),
		prev: vi.fn(),
		exitPresentation: vi.fn(),
		showAllSlides: vi.fn(),
		togglePresenterView: vi.fn(),
		setPointerTool: vi.fn(),
		eraseAnnotations: vi.fn(),
		toggleBlank: vi.fn(),
	};
	const menu = mountPresentationContextMenu({
		doc: document,
		store,
		root,
		getTranslator: () => t,
		shouldShow: options.shouldShow ?? (() => true),
		...callbacks,
	});
	return { root, menu, ...callbacks };
}

function rightClick(target: HTMLElement, x = 10, y = 20): void {
	target.dispatchEvent(
		new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
	);
}

describe('mountPresentationContextMenu', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it('opens a menu on right-click while presenting', () => {
		const { root, menu } = harness();
		rightClick(root);
		expect(root.querySelector('[data-pptx-presentation-menu]')).not.toBeNull();
		expect(root.querySelector('[data-item-id="next"]')).not.toBeNull();
		expect(root.querySelector('[data-item-id="endShow"]')).not.toBeNull();
		menu.destroy();
	});

	it('never opens when the option is off, but still swallows the click', () => {
		const { root, menu } = harness({ shouldShow: () => false });
		const event = new MouseEvent('contextmenu', {
			bubbles: true,
			cancelable: true,
			clientX: 1,
			clientY: 1,
		});
		root.dispatchEvent(event);
		expect(event.defaultPrevented).toBeTruthy();
		expect(root.querySelector('[data-pptx-presentation-menu]')).toBeNull();
		menu.destroy();
	});

	it('never opens while not presenting (the editor menu owns right-click there)', () => {
		const { root, menu } = harness({ presenting: false });
		rightClick(root);
		expect(root.querySelector('[data-pptx-presentation-menu]')).toBeNull();
		menu.destroy();
	});

	it('advances the slide and closes when "Next Slide" is chosen', () => {
		const { root, menu, next } = harness();
		rightClick(root);
		root.querySelector<HTMLButtonElement>('[data-item-id="next"]')?.click();
		expect(next).toHaveBeenCalledOnce();
		expect(root.querySelector('[data-pptx-presentation-menu]')).toBeNull();
		menu.destroy();
	});

	it('ends the show when "End Presentation" is chosen', () => {
		const { root, menu, exitPresentation } = harness();
		rightClick(root);
		root.querySelector<HTMLButtonElement>('[data-item-id="endShow"]')?.click();
		expect(exitPresentation).toHaveBeenCalledOnce();
		menu.destroy();
	});

	it('closes on Escape', () => {
		const { root, menu } = harness();
		rightClick(root);
		expect(root.querySelector('[data-pptx-presentation-menu]')).not.toBeNull();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(root.querySelector('[data-pptx-presentation-menu]')).toBeNull();
		menu.destroy();
	});
});
