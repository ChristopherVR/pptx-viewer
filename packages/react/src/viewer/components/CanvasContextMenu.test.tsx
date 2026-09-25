// @vitest-environment happy-dom
/**
 * The empty-canvas context menu: renders the shared six-command list, greys
 * Paste with an empty clipboard, renders Grid/Ruler as checkboxes, and closes
 * on Escape and outside click, matching `ContextMenu.escape.test.tsx`.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { CanvasContextMenu } = await import('./CanvasContextMenu');
type CanvasContextMenuProps = import('./canvas-context-menu-types').CanvasContextMenuProps;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

function props(overrides: Partial<CanvasContextMenuProps> = {}): CanvasContextMenuProps {
	return {
		canvasContextMenuState: { x: 40, y: 60 },
		mode: 'edit',
		hasClipboard: true,
		showGrid: false,
		showRulers: false,
		onPaste: vi.fn(),
		onOpenLayoutGallery: vi.fn(),
		onResetSlide: vi.fn(),
		onOpenFormatBackground: vi.fn(),
		onToggleGrid: vi.fn(),
		onToggleRulers: vi.fn(),
		onClose: vi.fn(),
		...overrides,
	};
}

describe('canvasContextMenu', () => {
	it('renders nothing when there is no menu state', () => {
		act(() => {
			root.render(<CanvasContextMenu {...props({ canvasContextMenuState: null as never })} />);
		});
		expect(container.querySelector('[data-pptx-canvas-context-menu]')).toBeNull();
	});

	it('renders the six shared commands with menu semantics', () => {
		act(() => {
			root.render(<CanvasContextMenu {...props()} />);
		});
		const menu = container.querySelector('[data-pptx-canvas-context-menu="true"]');
		expect(menu).not.toBeNull();
		expect(menu?.getAttribute('role')).toBe('menu');
		const items = container.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]');
		expect(items).toHaveLength(6);
	});

	it('keeps a menu opened near the bottom-right corner inside the window', () => {
		const rect = vi
			.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
			.mockReturnValue({ width: 180, height: 200 } as DOMRect);
		try {
			act(() => {
				root.render(
					<CanvasContextMenu
						{...props({
							canvasContextMenuState: { x: window.innerWidth - 10, y: window.innerHeight - 10 },
						})}
					/>,
				);
			});
			const menu = container.querySelector<HTMLElement>('[data-pptx-canvas-context-menu="true"]');
			expect(menu?.style.left).toBe(`${window.innerWidth - 180 - 8}px`);
			expect(menu?.style.top).toBe(`${window.innerHeight - 200 - 8}px`);
		} finally {
			rect.mockRestore();
		}
	});

	it('greys Paste when the clipboard is empty', () => {
		act(() => {
			root.render(<CanvasContextMenu {...props({ hasClipboard: false })} />);
		});
		const paste = Array.from(container.querySelectorAll('button')).find(
			(b) => b.textContent === 'pptx.contextMenu.paste',
		);
		expect(paste?.disabled).toBeTruthy();
	});

	it('renders Grid and Guides / Ruler as checkboxes reflecting current state', () => {
		act(() => {
			root.render(<CanvasContextMenu {...props({ showGrid: true, showRulers: false })} />);
		});
		const checkboxes = container.querySelectorAll('[role="menuitemcheckbox"]');
		expect(checkboxes).toHaveLength(2);
		expect(checkboxes[0].getAttribute('aria-checked')).toBe('true');
		expect(checkboxes[1].getAttribute('aria-checked')).toBe('false');
	});

	it('invokes the matching handler and closes on click', () => {
		const onToggleGrid = vi.fn();
		const onClose = vi.fn();
		act(() => {
			root.render(<CanvasContextMenu {...props({ onToggleGrid, onClose })} />);
		});
		const checkbox = container.querySelector('[role="menuitemcheckbox"]') as HTMLButtonElement;
		act(() => {
			checkbox.click();
		});
		expect(onToggleGrid).toHaveBeenCalledOnce();
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('closes on Escape', () => {
		const onClose = vi.fn();
		act(() => {
			root.render(<CanvasContextMenu {...props({ onClose })} />);
		});
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(onClose).toHaveBeenCalledOnce();
	});
});
