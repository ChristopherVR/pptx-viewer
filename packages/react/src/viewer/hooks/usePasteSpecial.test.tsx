// @vitest-environment happy-dom
import type { PptxElement, ShapePptxElement } from 'pptx-viewer-core';
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as exportHelpers from '../utils/export-helpers';
import type { ElementOperations } from './element-operations-types';
import type { UsePasteSpecialResult } from './usePasteSpecial';
import { usePasteSpecial } from './usePasteSpecial';

const SHAPE: ShapePptxElement = {
	type: 'shape',
	id: 'shape-1',
	x: 10,
	y: 10,
	width: 100,
	height: 50,
	rotation: 0,
	text: 'Hello',
	shapeStyle: { fillColor: '#ff0000' },
	textStyle: { color: '#0000ff' },
} as unknown as ShapePptxElement;

let container: HTMLDivElement;
let root: Root;
let latest: UsePasteSpecialResult;
let elements: PptxElement[];

function Harness(props: {
	clipboardPayload: { element: PptxElement; isTemplate: boolean } | null;
}) {
	const ops: ElementOperations = {
		updateActiveElements: (updater) => {
			elements = updater(elements);
		},
		applySelection: vi.fn(),
	} as unknown as ElementOperations;
	latest = usePasteSpecial({
		clipboardPayload: props.clipboardPayload,
		editTemplateMode: false,
		ops,
		markDirty: vi.fn(),
	});
	return null;
}

function render(clipboardPayload: { element: PptxElement; isTemplate: boolean } | null): void {
	act(() => {
		root.render(<Harness clipboardPayload={clipboardPayload} />);
	});
}

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	elements = [];
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
	vi.restoreAllMocks();
});

describe('usePasteSpecial dialog', () => {
	it('does not open with an empty clipboard', () => {
		render(null);
		act(() => latest.openPasteSpecialDialog());
		expect(latest.isPasteSpecialDialogOpen).toBeFalsy();
	});

	it('opens when the clipboard holds an element', () => {
		render({ element: SHAPE, isTemplate: false });
		act(() => latest.openPasteSpecialDialog());
		expect(latest.isPasteSpecialDialogOpen).toBeTruthy();
		act(() => latest.closePasteSpecialDialog());
		expect(latest.isPasteSpecialDialogOpen).toBeFalsy();
	});
});

describe('usePasteSpecial pasteWithFormat', () => {
	it('inserts a theme-stripped clone for use-destination-theme', async () => {
		render({ element: SHAPE, isTemplate: false });
		await act(async () => {
			await latest.pasteWithFormat('use-destination-theme');
		});
		expect(elements).toHaveLength(1);
		const pasted = elements[0] as ShapePptxElement;
		expect(pasted.id).not.toBe(SHAPE.id);
		expect(pasted.shapeStyle?.fillColor).toBeUndefined();
		expect(latest.isPasteSpecialDialogOpen).toBeFalsy();
		expect(latest.pasteOptionsToolbar?.elementId).toBe(pasted.id);
	});

	it('inserts a bare text box for keep-text-only', async () => {
		render({ element: SHAPE, isTemplate: false });
		await act(async () => {
			await latest.pasteWithFormat('keep-text-only');
		});
		expect(elements).toHaveLength(1);
		expect(elements[0]).toMatchObject({ type: 'text', text: 'Hello' });
	});

	it('inserts the plain clone for picture when the pasted node is not mounted (degrades gracefully)', async () => {
		const rasterSpy = vi.spyOn(exportHelpers, 'renderElementToRasterDataUrl');
		render({ element: SHAPE, isTemplate: false });
		await act(async () => {
			await latest.pasteWithFormat('picture');
		});
		// No `[data-element-id]` node exists in this harness, so the rasterize
		// step never finds anything to rasterize and the plain clone stands.
		expect(rasterSpy).not.toHaveBeenCalled();
		expect(elements).toHaveLength(1);
		expect(elements[0].type).toBe('shape');
	});

	it('replaces the pasted clone with a picture once its node is mounted', async () => {
		vi.spyOn(exportHelpers, 'renderElementToRasterDataUrl').mockResolvedValue(
			'data:image/png;base64,abc',
		);
		render({ element: SHAPE, isTemplate: false });
		// The real component tree mounts the pasted element under its own id
		// before the next frame; simulate that by tagging it once inserted.
		const originalRaf = globalThis.requestAnimationFrame;
		globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
			const pastedId = elements[0]?.id;
			if (pastedId) {
				const node = document.createElement('div');
				node.dataset.elementId = pastedId;
				node.dataset.pptxElement = 'true';
				document.body.appendChild(node);
			}
			return originalRaf(cb);
		}) as typeof requestAnimationFrame;
		try {
			await act(async () => {
				await latest.pasteWithFormat('picture');
			});
		} finally {
			globalThis.requestAnimationFrame = originalRaf;
			document.querySelectorAll('[data-element-id]').forEach((node) => node.remove());
		}
		expect(elements).toHaveLength(1);
		expect(elements[0].type).toBe('picture');
	});
});

describe('usePasteSpecial reformatPastedElement (Paste Options toolbar)', () => {
	/**
	 * PowerPoint's toolbar re-derives from the pristine source clone on every
	 * click, so repeated choices never compound: picking Keep Text Only then
	 * Use Destination Theme must produce a themed SHAPE, not a themed text box.
	 */
	it('re-derives every choice from the frozen source clone, never cumulatively', async () => {
		render({ element: SHAPE, isTemplate: false });
		await act(async () => {
			await latest.pasteWithFormat('keep-source-formatting');
		});
		const pastedId = latest.pasteOptionsToolbar?.elementId;

		await act(async () => {
			await latest.reformatPastedElement('keep-text-only');
		});
		expect(elements.find((el) => el.id === pastedId)?.type).toBe('text');

		await act(async () => {
			await latest.reformatPastedElement('use-destination-theme');
		});
		const reformatted = elements.find((el) => el.id === pastedId) as ShapePptxElement;
		expect(reformatted.type).toBe('shape');
		expect(reformatted.shapeStyle?.fillColor).toBeUndefined();
	});

	it('is a no-op once the toolbar has been dismissed', async () => {
		render({ element: SHAPE, isTemplate: false });
		await act(async () => {
			await latest.pasteWithFormat('keep-source-formatting');
		});
		const before = [...elements];
		act(() => latest.dismissPasteOptionsToolbar());
		await act(async () => {
			await latest.reformatPastedElement('keep-text-only' as PasteSpecialFormat);
		});
		expect(elements).toStrictEqual(before);
	});
});
