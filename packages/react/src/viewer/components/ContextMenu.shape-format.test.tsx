// @vitest-environment happy-dom
/**
 * The canvas context menu's Merge Shapes and Crop entries: offered from the
 * shared command list, routed to the viewer's shape-format commands.
 */
import type { PptxElement } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PictureCropController } from '../hooks/usePictureCropMode';
import type { ShapeFormatCommands } from './shape-format-context';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { ContextMenu } = await import('./ContextMenu');
const { ShapeFormatContext } = await import('./shape-format-context');
type ContextMenuProps = import('./context-menu-types').ContextMenuProps;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function commands(overrides: Partial<ShapeFormatCommands> = {}): ShapeFormatCommands {
	const crop = { enter: vi.fn() } as unknown as PictureCropController;
	return { canMergeShapes: false, mergeShapes: vi.fn(), crop, ...overrides };
}

function render(value: ShapeFormatCommands, overrides: Partial<ContextMenuProps>): void {
	const props: ContextMenuProps = {
		contextMenuState: { x: 10, y: 10, elementId: 'x' },
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
	act(() =>
		root.render(
			<ShapeFormatContext.Provider value={value}>
				<ContextMenu {...props} />
			</ShapeFormatContext.Provider>,
		),
	);
}

function item(label: string): HTMLElement | undefined {
	return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
		(node) => node.textContent === label,
	);
}

const shape = { id: 'a', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
const picture = { id: 'p', type: 'picture', x: 0, y: 0, width: 10, height: 10 } as PptxElement;

describe('context menu Merge Shapes and Crop', () => {
	it('offers the five merge entries on a mergeable multi-selection and runs them', () => {
		const value = commands({ canMergeShapes: true });
		render(value, { selectedElement: shape, hasMultiSelection: true });
		for (const op of ['Union', 'Combine', 'Fragment', 'Intersect', 'Subtract']) {
			expect(item(`pptx.contextMenu.merge${op}`)).toBeDefined();
		}
		act(() => item('pptx.contextMenu.mergeSubtract')?.click());
		expect(value.mergeShapes).toHaveBeenCalledWith('subtract');
	});

	it('omits the merge entries when the selection cannot merge', () => {
		render(commands(), { selectedElement: shape, hasMultiSelection: true });
		expect(item('pptx.contextMenu.mergeUnion')).toBeUndefined();
	});

	it('offers Crop for a single picture and enters crop mode', () => {
		const value = commands();
		render(value, { selectedElement: picture });
		const crop = item('pptx.contextMenu.crop');
		expect(crop).toBeDefined();
		act(() => crop?.click());
		expect(value.crop.enter).toHaveBeenCalledOnce();
	});
});
