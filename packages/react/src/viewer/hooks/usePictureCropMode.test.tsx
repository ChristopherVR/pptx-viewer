// @vitest-environment happy-dom
/**
 * On-canvas picture crop, end to end through React's REAL history.
 *
 * Wires the real `useEditorHistory` (with the crop session in its pointer
 * gate, as `PowerPointViewer` does), `useElementOperations`,
 * `useCropSessionState`, `usePictureCropMode` and the `PictureCropOverlay`,
 * then drives the overlay with pointer events: a handle drag must crop LIVE,
 * Escape must restore with no undo step, and Enter must commit exactly ONE
 * undo step that restores the pre-crop picture.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React, { act, useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CanvasSize, ElementContextMenuState } from '../types';
import type { PictureCropController } from './usePictureCropMode';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { PictureCropOverlay } = await import('../components/canvas/PictureCropOverlay');
const { useCropSessionState } = await import('./useCropSessionState');
const { useEditorHistory } = await import('./useEditorHistory');
const { useElementOperations } = await import('./useElementOperations');
const { usePictureCropMode } = await import('./usePictureCropMode');

const PIC_ID = 'pic-1';

function makeSlides(): PptxSlide[] {
	return [
		{
			id: 'slide-1',
			rId: 'rId1',
			slideNumber: 1,
			elements: [
				{
					id: PIC_ID,
					type: 'picture',
					x: 100,
					y: 100,
					width: 200,
					height: 100,
					imageData: 'data:image/png;base64,iVBORw0KGgo=',
				} as unknown as PptxElement,
			],
		} as unknown as PptxSlide,
	];
}

interface HarnessApi {
	crop: () => PictureCropController;
	picture: () => PptxElement;
	canUndo: () => boolean;
	undo: () => void;
}

let api: HarnessApi | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function noop<T>(): React.Dispatch<React.SetStateAction<T>> {
	return () => {};
}

function Harness(): React.ReactElement {
	const [slides, setSlides] = useState<PptxSlide[]>(makeSlides);
	const [canvasSize, setCanvasSize] = useState<CanvasSize>({ width: 960, height: 540 });
	const [activeSlideIndex, setActiveSlideIndex] = useState(0);
	const [templates, setTemplates] = useState<Record<string, PptxElement[]>>({});
	const [selectedElementId, setSelectedElementId] = useState<string | null>(PIC_ID);
	const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
	const cropState = useCropSessionState();
	const gate = useCallback(() => Boolean(cropState.cropSessionRef.current), [cropState]);

	const history = useEditorHistory({
		slides,
		canvasSize,
		activeSlideIndex,
		templateElementsBySlideId: templates,
		selectedElementId,
		selectedElementIds,
		editTemplateMode: false,
		headerFooter: {} as never,
		loading: false,
		error: null,
		hasActivePointerInteraction: gate,
		pointerCommitNonce: 0,
		setSlides,
		setCanvasSize,
		setActiveSlideIndex,
		setTemplateElementsBySlideId: setTemplates,
		setSelectedElementId,
		setSelectedElementIds,
		setEditTemplateMode: noop<boolean>(),
		setHeaderFooter: noop<never>(),
	});
	const activeSlide = slides[activeSlideIndex];
	const lookup = useMemo(
		() => new Map((activeSlide?.elements ?? []).map((el) => [el.id, el])),
		[activeSlide],
	);
	const selectedElement = selectedElementId ? (lookup.get(selectedElementId) ?? null) : null;
	const ops = useElementOperations({
		slides,
		activeSlide,
		activeSlideIndex,
		selectedElement,
		selectedElementId,
		editTemplateMode: false,
		templateElements: [],
		history,
		setSlides,
		setTemplateElementsBySlideId: setTemplates,
		setSelectedElementId,
		setSelectedElementIds,
		setInlineEditingElementId: noop<string | null>(),
		setContextMenuState: noop<ElementContextMenuState | null>(),
		inlineEditingElementId: null,
		inlineEditingText: '',
	});
	const crop = usePictureCropMode({
		...cropState,
		editable: true,
		selectedElement,
		effectiveSelectedIds: selectedElementIds.length
			? selectedElementIds
			: selectedElementId
				? [selectedElementId]
				: [],
		elementLookup: lookup,
		activeSlideIndex,
		updateElementById: ops.updateElementById,
		markDirty: history.markDirty,
	});
	const latest = useRef({ crop, history, slides });
	latest.current = { crop, history, slides };
	api = {
		crop: () => latest.current.crop,
		picture: () => latest.current.slides[0].elements[0],
		canUndo: () => latest.current.history.canUndo,
		undo: () => latest.current.history.handleUndo(),
	};
	return (
		<div>
			{crop.element && (
				<PictureCropOverlay element={crop.element} scale={1} onUpdate={crop.liveUpdate} />
			)}
		</div>
	);
}

function mount(): HarnessApi {
	container = document.createElement('div');
	document.body.append(container);
	root = createRoot(container);
	act(() => root?.render(<Harness />));
	if (!api) {
		throw new Error('harness did not mount');
	}
	return api;
}

afterEach(() => {
	act(() => root?.unmount());
	container?.remove();
	root = null;
	api = null;
});

/** Let the history hook's deferred re-check observe the released gate. */
async function settle(): Promise<void> {
	await act(async () => {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 80);
		});
	});
}

function handle(id: string): HTMLElement {
	const node = document.querySelector<HTMLElement>(`[data-pptx-crop-handle="${id}"]`);
	if (!node) {
		throw new Error(`no crop handle ${id}`);
	}
	return node;
}

function dragHandle(id: string, dx: number): void {
	act(() => {
		handle(id).dispatchEvent(
			new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
		);
	});
	act(() => {
		window.dispatchEvent(new PointerEvent('pointermove', { clientX: dx, clientY: 0 }));
	});
	act(() => {
		window.dispatchEvent(new PointerEvent('pointerup', { clientX: dx, clientY: 0 }));
	});
}

function press(key: string): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
	act(() => {
		document.body.dispatchEvent(event);
	});
	return event;
}

describe('on-canvas picture crop', () => {
	it('renders the overlay with eight handles in crop mode', async () => {
		const harness = mount();
		await settle();
		act(() => harness.crop().enter());
		expect(document.querySelector('[data-pptx-crop-overlay="true"]')).not.toBeNull();
		expect(document.querySelectorAll('[data-pptx-crop-handle]')).toHaveLength(8);
		expect(document.querySelector('[data-pptx-crop-frame]')).not.toBeNull();
	});

	it('crops live on a handle drag, and Escape restores with no undo step', async () => {
		const harness = mount();
		await settle();
		act(() => harness.crop().enter());
		dragHandle('w', 40);
		const cropped = harness.picture() as PptxElement & { cropLeft?: number };
		expect(cropped.cropLeft).toBeCloseTo(0.2, 3);
		expect(cropped.x).toBe(140);

		const escape = press('Escape');
		expect(escape.defaultPrevented).toBeTruthy();
		await settle();
		const restored = harness.picture() as PptxElement & { cropLeft?: number };
		expect(restored.cropLeft ?? 0).toBe(0);
		expect(restored.x).toBe(100);
		expect(harness.crop().element).toBeNull();
		expect(harness.canUndo()).toBeFalsy();
	});

	it('enter commits the whole session as exactly one undo step', async () => {
		const harness = mount();
		await settle();
		act(() => harness.crop().enter());
		dragHandle('w', 40);
		dragHandle('e', -20);
		press('Enter');
		await settle();
		expect(harness.crop().element).toBeNull();
		const committed = harness.picture() as PptxElement & { cropRight?: number };
		expect(committed.cropRight).toBeCloseTo(0.1, 3);
		expect(harness.canUndo()).toBeTruthy();

		act(() => harness.undo());
		await settle();
		const undone = harness.picture() as PptxElement & { cropLeft?: number; cropRight?: number };
		expect(undone.cropLeft ?? 0).toBe(0);
		expect(undone.cropRight ?? 0).toBe(0);
		expect(undone.x).toBe(100);
		expect(harness.canUndo()).toBeFalsy();
	});

	it('pressing Crop again commits, and an unchanged session leaves no undo step', async () => {
		const harness = mount();
		await settle();
		act(() => harness.crop().toggle());
		expect(harness.crop().element).not.toBeNull();
		act(() => harness.crop().toggle());
		await settle();
		expect(harness.crop().element).toBeNull();
		expect(harness.canUndo()).toBeFalsy();
	});
});
