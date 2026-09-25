// @vitest-environment happy-dom
/**
 * Home > Arrange > Merge Shapes and Crop in the React ribbon.
 *
 * The merge dropdown is driven through the REAL `useMergeShapesHandler` (the
 * thin wrapper over the shared planner), so choosing an operation here proves
 * the whole path: two overlapping shapes go in, one custom-geometry shape
 * comes out in the first-selected shape's place.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { ToolbarActionId } from 'pptx-viewer-shared';
import React, { act, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PictureCropController } from '../../hooks/usePictureCropMode';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { ShapeArrangeExtras } = await import('./ShapeArrangeExtras');
const { ShapeFormatContext } = await import('../shape-format-context');
const { useMergeShapesHandler } = await import('../../hooks/useMergeShapesHandler');
type ElementOperations = import('../../hooks/useElementOperations').ElementOperations;
type EditorHistoryResult = import('../../hooks/useEditorHistory').EditorHistoryResult;

function rect(id: string, x: number, shapeType: string, fill: string): PptxElement {
	return {
		id,
		type: 'shape',
		x,
		y: 50,
		width: 100,
		height: 100,
		shapeType,
		shapeStyle: { fillColor: fill, fillMode: 'solid' },
	} as unknown as PptxElement;
}

const picture = {
	id: 'pic',
	type: 'picture',
	x: 0,
	y: 0,
	width: 50,
	height: 50,
} as unknown as PptxElement;

function cropStub(overrides: Partial<PictureCropController> = {}): PictureCropController {
	return {
		element: null,
		canCrop: false,
		toggle: vi.fn(),
		enter: vi.fn(),
		commit: vi.fn(),
		cancel: vi.fn(),
		liveUpdate: vi.fn(),
		cropToAspect: vi.fn(),
		fill: vi.fn(),
		fit: vi.fn(),
		...overrides,
	};
}

let latestSlides: PptxSlide[] = [];
let selectedAfter: string | null = null;

interface HarnessProps {
	selectedIds: string[];
	crop?: PictureCropController;
	hiddenActions?: ToolbarActionId[];
}

function Harness({ selectedIds, crop = cropStub(), hiddenActions }: HarnessProps) {
	const [slides, setSlides] = useState<PptxSlide[]>(() => [
		{
			id: 's1',
			elements: [rect('a', 50, 'rect', '#ff0000'), rect('b', 100, 'ellipse', '#0000ff'), picture],
		} as unknown as PptxSlide,
	]);
	latestSlides = slides;
	const elements = slides[0].elements;
	const selectedElements = selectedIds
		.map((id) => elements.find((el) => el.id === id))
		.filter((el): el is PptxElement => Boolean(el));
	const ops = {
		updateSlides: (updater: (s: PptxSlide[]) => PptxSlide[]) => setSlides(updater),
		applySelection: (id: string | null) => {
			selectedAfter = id;
		},
	} as unknown as ElementOperations;
	const merge = useMergeShapesHandler({
		activeSlide: slides[0],
		activeSlideIndex: 0,
		selectedElements,
		effectiveSelectedIds: selectedIds,
		setSelectedElementIds: () => {},
		ops,
		history: { markDirty: () => {} } as unknown as EditorHistoryResult,
	});
	const value = useMemo(
		() => ({ canMergeShapes: merge.canMergeShapes, mergeShapes: merge.handleMergeShapes, crop }),
		[merge.canMergeShapes, merge.handleMergeShapes, crop],
	);
	return (
		<ShapeFormatContext.Provider value={value}>
			<ShapeArrangeExtras
				canEdit
				selectedElement={selectedElements[0] ?? null}
				selectedCount={selectedIds.length}
				selectionGroupable
				onGroupElements={() => {}}
				onUngroupElement={() => {}}
				onUpdateElementStyle={() => {}}
				hiddenActions={hiddenActions}
			/>
		</ShapeFormatContext.Provider>
	);
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	selectedAfter = null;
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function render(props: HarnessProps): void {
	act(() => root.render(<Harness {...props} />));
}

function control(id: string): HTMLButtonElement | null {
	return container.querySelector<HTMLButtonElement>(`[data-pptx-ribbon-control="${id}"]`);
}

describe('ribbon Merge Shapes', () => {
	it('is disabled with the hint for fewer than two shapes', () => {
		render({ selectedIds: ['a'] });
		const button = control('merge-shapes');
		expect(button?.disabled).toBeTruthy();
		expect(button?.title).toBe('pptx.shape.mergeShapesHint');
		expect(button?.getAttribute('aria-label')).toBe('pptx.shape.mergeShapes');
	});

	it('lists the five operations and Union replaces two shapes with one freeform', () => {
		render({ selectedIds: ['a', 'b'] });
		const button = control('merge-shapes');
		expect(button?.disabled).toBeFalsy();
		act(() => button?.click());
		const menu = document.querySelector('[role="menu"]');
		const items = Array.from(document.querySelectorAll<HTMLElement>('[data-pptx-merge-op]'));
		expect(menu).not.toBeNull();
		expect(items.map((item) => item.dataset.pptxMergeOp)).toStrictEqual([
			'union',
			'combine',
			'fragment',
			'intersect',
			'subtract',
		]);
		expect(items.every((item) => item.getAttribute('role') === 'menuitem')).toBeTruthy();

		act(() => items[0].click());
		const after = latestSlides[0].elements;
		expect(after.map((el) => el.id)).not.toContain('a');
		expect(after.map((el) => el.id)).not.toContain('b');
		expect(after).toHaveLength(2);
		const merged = after[0] as PptxElement & { shapeType?: string; pathData?: string };
		expect(merged.type).toBe('shape');
		expect(merged.shapeType).toBe('custom');
		expect(merged.pathData).toBeTruthy();
		expect(merged.x).toBe(50);
		expect(merged.width).toBeCloseTo(150, 0);
		expect(selectedAfter).toBe(merged.id);
	});

	it('disappears when the host hides mergeShapes', () => {
		render({ selectedIds: ['a', 'b'], hiddenActions: ['mergeShapes'] });
		expect(control('merge-shapes')).toBeNull();
		expect(control('crop')).not.toBeNull();
	});
});

describe('ribbon Crop', () => {
	it('is disabled with the hint when nothing croppable is selected', () => {
		render({ selectedIds: ['a'] });
		expect(control('crop')?.disabled).toBeTruthy();
		expect(control('crop')?.title).toBe('pptx.image.cropHint');
		expect(control('crop-menu')?.disabled).toBeTruthy();
	});

	it('toggles crop mode and reflects it in aria-pressed', () => {
		const toggle = vi.fn();
		render({ selectedIds: ['pic'], crop: cropStub({ canCrop: true, toggle }) });
		expect(control('crop')?.getAttribute('aria-pressed')).toBe('false');
		act(() => control('crop')?.click());
		expect(toggle).toHaveBeenCalledOnce();

		render({ selectedIds: ['pic'], crop: cropStub({ canCrop: true, element: picture }) });
		expect(control('crop')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('offers the aspect presets, Fill and Fit', () => {
		const crop = cropStub({ canCrop: true });
		render({ selectedIds: ['pic'], crop });
		act(() => control('crop-menu')?.click());
		const aspects = Array.from(
			document.querySelectorAll<HTMLElement>('[data-pptx-crop-aspect]'),
		).map((node) => node.dataset.pptxCropAspect);
		expect(aspects).toContain('1:1');
		expect(aspects).toContain('16:9');
		act(() => document.querySelector<HTMLElement>('[data-pptx-crop-aspect="16:9"]')?.click());
		expect(crop.cropToAspect).toHaveBeenCalledWith(16, 9);

		act(() => control('crop-menu')?.click());
		act(() => document.querySelector<HTMLElement>('[data-pptx-crop-action="fill"]')?.click());
		expect(crop.fill).toHaveBeenCalledOnce();
		act(() => control('crop-menu')?.click());
		act(() => document.querySelector<HTMLElement>('[data-pptx-crop-action="fit"]')?.click());
		expect(crop.fit).toHaveBeenCalledOnce();
	});

	it('disappears when the host hides crop', () => {
		render({ selectedIds: ['pic'], crop: cropStub({ canCrop: true }), hiddenActions: ['crop'] });
		expect(control('crop')).toBeNull();
		expect(control('crop-menu')).toBeNull();
	});
});
