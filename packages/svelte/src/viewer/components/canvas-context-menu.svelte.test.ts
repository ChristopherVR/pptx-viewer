import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorState } from '../editor/editor-state.svelte';
import CanvasContextMenu from './CanvasContextMenu.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function createEditor(hasClipboard = true): EditorState {
	return {
		hasClipboard,
		clipboardOps: { pasteClipboard: vi.fn() },
		slidesOps: { resetSlide: vi.fn().mockResolvedValue(null) },
		selection: { clear: vi.fn() },
	} as unknown as EditorState;
}

interface MenuOptions {
	onclose?: () => void;
	showGrid?: boolean;
	showRulers?: boolean;
	onopenlayoutgallery?: () => void;
	onresetslide?: () => void;
	onopenformatbackground?: () => void;
	ontogglegrid?: () => void;
	ontogglerulers?: () => void;
}

function mountMenu(editor: EditorState, options: MenuOptions = {}): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(CanvasContextMenu, {
		target,
		props: {
			x: 24,
			y: 40,
			editor,
			showGrid: options.showGrid ?? false,
			showRulers: options.showRulers ?? false,
			onopenlayoutgallery: options.onopenlayoutgallery ?? vi.fn(),
			onresetslide: options.onresetslide ?? vi.fn(),
			onopenformatbackground: options.onopenformatbackground ?? vi.fn(),
			ontogglegrid: options.ontogglegrid ?? vi.fn(),
			ontogglerulers: options.ontogglerulers ?? vi.fn(),
			onclose: options.onclose ?? vi.fn(),
		},
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function items(target: HTMLElement): HTMLButtonElement[] {
	return Array.from(target.querySelectorAll<HTMLButtonElement>('button'));
}

describe('canvasContextMenu', () => {
	it('renders the neutral markers and the six shared commands', () => {
		const target = mountMenu(createEditor());
		expect(target.querySelector('[data-pptx-context-menu="true"]')).not.toBeNull();
		expect(target.querySelector('[data-pptx-canvas-context-menu="true"]')).not.toBeNull();
		expect(items(target)).toHaveLength(6);
	});

	it('greys Paste when the clipboard is empty', () => {
		const target = mountMenu(createEditor(false));
		const paste = items(target).find((b) => b.textContent?.includes('Paste'));
		expect(paste?.disabled).toBeTruthy();
	});

	it('renders Grid and Guides / Ruler as menuitemcheckbox, reflecting state', () => {
		const target = mountMenu(createEditor(), { showGrid: true, showRulers: false });
		const checkboxes = target.querySelectorAll('[role="menuitemcheckbox"]');
		expect(checkboxes).toHaveLength(2);
		expect(checkboxes[0].getAttribute('aria-checked')).toBe('true');
		expect(checkboxes[1].getAttribute('aria-checked')).toBe('false');
	});

	it('invokes the matching handler and closes on click', () => {
		const ontogglegrid = vi.fn();
		const onclose = vi.fn();
		const target = mountMenu(createEditor(), { ontogglegrid, onclose });
		const checkbox = target.querySelector('[role="menuitemcheckbox"]') as HTMLButtonElement;
		checkbox.click();
		expect(ontogglegrid).toHaveBeenCalledOnce();
		expect(onclose).toHaveBeenCalledOnce();
	});

	it('closes on Escape', () => {
		const onclose = vi.fn();
		mountMenu(createEditor(), { onclose });
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		expect(onclose).toHaveBeenCalledOnce();
	});
});
