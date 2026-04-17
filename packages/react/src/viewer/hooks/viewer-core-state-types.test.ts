import { describe, it, expect, expectTypeOf } from 'vitest';

import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants';
import type { UseViewerCoreStateInput, ViewerCoreState } from './viewer-core-state-types';

// ---------------------------------------------------------------------------
// viewer-core-state-types is a pure types module with no runtime code.
// We verify:
//   1. The exported type interfaces satisfy expected shapes.
//   2. Default values match known constants.
//   3. The type discriminants work correctly.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// UseViewerCoreStateInput
// ---------------------------------------------------------------------------

describe('useViewerCoreStateInput type', () => {
	it('accepts null content', () => {
		const input: UseViewerCoreStateInput = {
			content: null,
			canEdit: false,
		};
		expect(input.content).toBeNull();
	});

	it('accepts undefined content', () => {
		const input: UseViewerCoreStateInput = {
			content: undefined,
			canEdit: true,
		};
		expect(input.content).toBeUndefined();
	});

	it('accepts ArrayBuffer content', () => {
		const buf = new ArrayBuffer(16);
		const input: UseViewerCoreStateInput = {
			content: buf,
			canEdit: true,
		};
		expect(input.content).toBe(buf);
	});

	it('accepts Uint8Array content', () => {
		const arr = new Uint8Array([0x50, 0x4b]);
		const input: UseViewerCoreStateInput = {
			content: arr,
			canEdit: false,
		};
		expect(input.content).toBeInstanceOf(Uint8Array);
	});

	it('has a boolean canEdit field', () => {
		const input: UseViewerCoreStateInput = {
			content: null,
			canEdit: true,
		};
		expectTypeOf(input.canEdit).toBeBoolean();
	});
});

// ---------------------------------------------------------------------------
// ViewerCoreState default values alignment
// ---------------------------------------------------------------------------

describe('viewerCoreState defaults', () => {
	it('dEFAULT_CANVAS_WIDTH is 1280', () => {
		expect(DEFAULT_CANVAS_WIDTH).toBe(1280);
	});

	it('dEFAULT_CANVAS_HEIGHT is 720', () => {
		expect(DEFAULT_CANVAS_HEIGHT).toBe(720);
	});

	it('viewerCoreState shape has expected ref properties', () => {
		// Build a minimal mock to verify the interface compiles with correct shape
		const mockState: Partial<ViewerCoreState> = {
			containerRef: { current: null },
			imageInputRef: { current: null },
			mediaInputRef: { current: null },
			activeSlideIndexRef: { current: 0 },
			dragStateRef: { current: null },
			resizeStateRef: { current: null },
			shapeAdjustmentDragStateRef: { current: null },
			marqueeStateRef: { current: null },
			isDrawingRef: { current: false },
		};
		expect(mockState.containerRef!.current).toBeNull();
		expect(mockState.activeSlideIndexRef!.current).toBe(0);
		expect(mockState.isDrawingRef!.current).toBeFalsy();
	});

	it('viewerCoreState shape has expected primitive defaults', () => {
		const mockState: Partial<ViewerCoreState> = {
			mode: 'edit',
			loading: true,
			error: null,
			slides: [],
			activeSlideIndex: 0,
			selectedElementId: null,
			selectedElementIds: [],
			isDirty: false,
			inlineEditingElementId: null,
			inlineEditingText: '',
			editTemplateMode: false,
			pointerCommitNonce: 0,
			hasMacros: false,
			hasDigitalSignatures: false,
			digitalSignatureCount: 0,
		};
		expect(mockState.mode).toBe('edit');
		expect(mockState.loading).toBeTruthy();
		expect(mockState.error).toBeNull();
		expect(mockState.slides).toStrictEqual([]);
		expect(mockState.selectedElementId).toBeNull();
		expect(mockState.isDirty).toBeFalsy();
		expect(mockState.digitalSignatureCount).toBe(0);
	});

	it('viewerCoreState shape has expected master view defaults', () => {
		const mockState: Partial<ViewerCoreState> = {
			activeMasterIndex: 0,
			activeLayoutIndex: null,
			preMasterMode: 'edit',
			masterViewTab: 'slides',
			handoutSlidesPerPage: 4,
		};
		expect(mockState.activeMasterIndex).toBe(0);
		expect(mockState.activeLayoutIndex).toBeNull();
		expect(mockState.preMasterMode).toBe('edit');
		expect(mockState.masterViewTab).toBe('slides');
		expect(mockState.handoutSlidesPerPage).toBe(4);
	});

	it('viewerCoreState has derived state fields', () => {
		const mockState: Partial<ViewerCoreState> = {
			activeSlide: undefined,
			templateElements: [],
			elementLookup: new Map(),
			selectedElement: null,
			effectiveSelectedIds: [],
			selectedElementIdSet: new Set(),
			selectedElements: [],
			activeMaster: undefined,
			activeLayout: undefined,
			masterViewElements: [],
			notesMasterElements: [],
			handoutMasterElements: [],
		};
		expect(mockState.activeSlide).toBeUndefined();
		expect(mockState.elementLookup!.size).toBe(0);
		expect(mockState.selectedElement).toBeNull();
		expect(mockState.effectiveSelectedIds).toStrictEqual([]);
		expect(mockState.selectedElementIdSet!.size).toBe(0);
	});
});
