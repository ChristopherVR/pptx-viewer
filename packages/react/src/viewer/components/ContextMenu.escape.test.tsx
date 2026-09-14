// @vitest-environment happy-dom
/**
 * Escape dismisses the canvas context menu. The other four bindings' menus
 * already did this; React's only closed on an outside click, so a keyboard
 * user who opened it with Shift+F10 had no way back out.
 */
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { ContextMenu } = await import('./ContextMenu');
type ContextMenuProps = import('./context-menu-types').ContextMenuProps;

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

function props(overrides: Partial<ContextMenuProps> = {}): ContextMenuProps {
	return {
		contextMenuState: { x: 40, y: 60, elementId: 'sp_1' },
		mode: 'edit',
		selectedElement: null,
		tableEditorState: null,
		onAction: vi.fn(),
		onInsertTableRow: vi.fn(),
		onDeleteTableRow: vi.fn(),
		onInsertTableColumn: vi.fn(),
		onDeleteTableColumn: vi.fn(),
		onClose: vi.fn(),
		...overrides,
	};
}

describe('contextMenu Escape', () => {
	it('closes an open menu on Escape', () => {
		const onClose = vi.fn();
		act(() => {
			root.render(<ContextMenu {...props({ onClose })} />);
		});
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('ignores Escape while the menu is closed', () => {
		const onClose = vi.fn();
		act(() => {
			root.render(<ContextMenu {...props({ onClose, contextMenuState: null })} />);
		});
		act(() => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(onClose).not.toHaveBeenCalled();
	});
});
