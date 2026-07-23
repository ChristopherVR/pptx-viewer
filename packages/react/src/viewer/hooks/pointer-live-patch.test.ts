/**
 * Regression test for the collaboration live-preview channel: React's drag and
 * resize write straight to the DOM and only commit to `slides` on pointer-up,
 * so without the live patch remote peers saw nothing until the gesture ended.
 * These tests assert the Y.Doc already carries the in-flight geometry BEFORE
 * `processPointerUp` runs.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	createCollaborationLivePatcher,
	readSlidesFromYDoc,
	reconcileSlidesInYDoc,
} from 'pptx-viewer-shared';
import type { YDocLike, YjsFactories } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import type { UsePointerHandlersInput, PointerFrameTracker } from './pointer-handler-types';
import { processPointerMove } from './pointer-move-handlers';
import { processPointerUp } from './pointer-up-handlers';

const factories: YjsFactories = {
	createMap: () => new Y.Map() as unknown as ReturnType<YjsFactories['createMap']>,
	createArray: () => new Y.Array() as unknown as ReturnType<YjsFactories['createArray']>,
	createText: () => new Y.Text() as unknown as ReturnType<YjsFactories['createText']>,
};

const asDoc = (doc: Y.Doc): YDocLike => doc as unknown as YDocLike;

const element = (id: string): PptxElement =>
	({
		id,
		type: 'shape',
		shapeType: 'rect',
		x: 100,
		y: 100,
		width: 200,
		height: 150,
	}) as unknown as PptxElement;

const slide = (elements: PptxElement[]): PptxSlide =>
	({ id: 's1', slideNumber: 1, elements }) as unknown as PptxSlide;

function docElement(doc: Y.Doc, id: string): Record<string, unknown> | undefined {
	const found = readSlidesFromYDoc(asDoc(doc))[0].elements.find((el) => el.id === id);
	return found as unknown as Record<string, unknown> | undefined;
}

function makeInput(
	activeSlide: PptxSlide,
	patcher: ReturnType<typeof createCollaborationLivePatcher>,
	overrides: Partial<UsePointerHandlersInput> = {},
): UsePointerHandlersInput {
	return {
		editorScale: 1,
		canvasStageRef: { current: null },
		canvasSize: { width: 960, height: 540 },
		activeSlide,
		activeSlideIndex: 0,
		gridSpacingPx: 8,
		dragStateRef: { current: null },
		resizeStateRef: { current: null },
		shapeAdjustmentDragStateRef: { current: null },
		marqueeStateRef: { current: null },
		editTemplateMode: false,
		snapToGrid: false,
		snapToShape: false,
		guides: [],
		templateElements: [],
		elementLookup: new Map(activeSlide.elements.map((el) => [el.id, el])),
		setMarqueeSelectionState: vi.fn(),
		setSnapLines: vi.fn(),
		setTemplateElementsBySlideId: vi.fn(),
		setPointerCommitNonce: vi.fn(),
		effectiveSelectedIds: [],
		applySelection: vi.fn(),
		clearSelection: vi.fn(),
		updateSlides: vi.fn(),
		updateElementById: vi.fn(),
		markDirty: vi.fn(),
		livePatcher: patcher,
		...overrides,
	} as UsePointerHandlersInput;
}

const move = (clientX: number, clientY: number): PointerEvent =>
	({ clientX, clientY }) as unknown as PointerEvent;

const newTracker = (): PointerFrameTracker => ({
	rafId: 0,
	pendingMoveEvent: null,
	lastSnapLinesKey: '',
});

function seed(activeSlide: PptxSlide): {
	doc: Y.Doc;
	patcher: ReturnType<typeof createCollaborationLivePatcher>;
} {
	const doc = new Y.Doc();
	reconcileSlidesInYDoc([activeSlide], asDoc(doc), factories);
	const patcher = createCollaborationLivePatcher();
	patcher.configure(asDoc(doc), factories);
	return { doc, patcher };
}

describe('pointer live patch', () => {
	it('publishes a drag to the Y.Doc before pointer-up', () => {
		const active = slide([element('e1')]);
		const { doc, patcher } = seed(active);
		const input = makeInput(active, patcher);
		input.dragStateRef.current = {
			elementId: 'e1',
			startClientX: 0,
			startClientY: 0,
			startPositionsById: { e1: { x: 100, y: 100 } },
			domEls: new Map(),
			moved: false,
			lastDx: 0,
			lastDy: 0,
		};

		processPointerMove(move(40, 25), input, newTracker());

		// The gesture has NOT ended: updateSlides was never called, yet the doc
		// already reflects the new position for remote peers.
		expect(input.updateSlides).not.toHaveBeenCalled();
		expect(docElement(doc, 'e1')?.x).toBe(140);
		expect(docElement(doc, 'e1')?.y).toBe(125);
	});

	it('publishes a resize to the Y.Doc before pointer-up, then flushes on commit', () => {
		const active = slide([element('e1')]);
		const { doc, patcher } = seed(active);
		const input = makeInput(active, patcher);
		input.resizeStateRef.current = {
			elementId: 'e1',
			startClientX: 0,
			startClientY: 0,
			startX: 100,
			startY: 100,
			startWidth: 200,
			startHeight: 150,
			handle: 'se',
			moved: false,
			domEl: null,
			lastX: 100,
			lastY: 100,
			lastWidth: 200,
			lastHeight: 150,
		};

		processPointerMove(move(50, 30), input, newTracker());
		expect(input.updateElementById).not.toHaveBeenCalled();
		expect(docElement(doc, 'e1')?.width).toBe(250);
		expect(docElement(doc, 'e1')?.height).toBe(180);

		// A second frame inside the throttle window is only published by the
		// pointer-up flush, never left pending.
		processPointerMove(move(80, 60), input, newTracker());
		processPointerUp(input);
		expect(docElement(doc, 'e1')?.width).toBe(280);
		expect(docElement(doc, 'e1')?.height).toBe(210);
	});

	it('does not publish while editing template elements', () => {
		const active = slide([element('e1')]);
		const { doc, patcher } = seed(active);
		const input = makeInput(active, patcher, { editTemplateMode: true });
		input.dragStateRef.current = {
			elementId: 'e1',
			startClientX: 0,
			startClientY: 0,
			startPositionsById: { e1: { x: 100, y: 100 } },
			domEls: new Map(),
			moved: false,
			lastDx: 0,
			lastDy: 0,
		};

		processPointerMove(move(40, 25), input, newTracker());
		expect(docElement(doc, 'e1')?.x).toBe(100);
	});

	it('is inert when no live patcher is attached', () => {
		const active = slide([element('e1')]);
		const input = makeInput(active, createCollaborationLivePatcher(), { livePatcher: undefined });
		input.dragStateRef.current = {
			elementId: 'e1',
			startClientX: 0,
			startClientY: 0,
			startPositionsById: { e1: { x: 100, y: 100 } },
			domEls: new Map(),
			moved: false,
			lastDx: 0,
			lastDy: 0,
		};

		expect(() => {
			processPointerMove(move(40, 25), input, newTracker());
			processPointerUp(input);
		}).not.toThrow();
	});
});
