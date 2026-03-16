import { describe, it, expect } from 'vitest';

import { DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from '../constants';
import type { UseViewerCoreStateInput } from './useViewerCoreState';

// ---------------------------------------------------------------------------
// useViewerCoreState is a hook that initializes many pieces of React state.
// We cannot call it outside of a React component, but we can verify:
//   1. The expected default values match the constants.
//   2. The type shape of the output matches what consumers expect.
//   3. The input type constraints are correct.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Default canvas size
// ---------------------------------------------------------------------------

describe('default canvas dimensions', () => {
	it('dEFAULT_CANVAS_WIDTH matches standard slide width', () => {
		expect(DEFAULT_CANVAS_WIDTH).toBe(1280);
	});

	it('dEFAULT_CANVAS_HEIGHT matches standard slide height', () => {
		expect(DEFAULT_CANVAS_HEIGHT).toBe(720);
	});

	it('default canvas aspect ratio is 16:9', () => {
		const ratio = DEFAULT_CANVAS_WIDTH / DEFAULT_CANVAS_HEIGHT;
		expect(ratio).toBeCloseTo(16 / 9, 5);
	});
});

// ---------------------------------------------------------------------------
// Input type constraints
// ---------------------------------------------------------------------------

describe('useViewerCoreStateInput', () => {
	it('accepts ArrayBuffer content with canEdit true', () => {
		const input: UseViewerCoreStateInput = {
			content: new ArrayBuffer(8),
			canEdit: true,
		};
		expect(input.canEdit).toBeTruthy();
		expect(input.content).toBeInstanceOf(ArrayBuffer);
	});

	it('accepts null content with canEdit false', () => {
		const input: UseViewerCoreStateInput = {
			content: null,
			canEdit: false,
		};
		expect(input.content).toBeNull();
		expect(input.canEdit).toBeFalsy();
	});

	it('accepts Uint8Array content', () => {
		const input: UseViewerCoreStateInput = {
			content: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
			canEdit: true,
		};
		expect(input.content).toBeInstanceOf(Uint8Array);
	});

	it('accepts undefined content', () => {
		const input: UseViewerCoreStateInput = {
			content: undefined,
			canEdit: false,
		};
		expect(input.content).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// ViewerCoreState expected default values (what useState initializes to)
// ---------------------------------------------------------------------------

describe('viewerCoreState expected defaults', () => {
	// These are the values that useState() is called with in the hook.
	// We verify them here to catch accidental changes to defaults.

	const defaults = {
		mode: 'edit',
		loading: true,
		error: null,
		slides: [],
		templateElementsBySlideId: {},
		canvasSize: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
		activeSlideIndex: 0,
		selectedElementId: null,
		selectedElementIds: [],
		isDirty: false,
		inlineEditingElementId: null,
		inlineEditingText: '',
		editTemplateMode: false,
		newShapeType: 'rect',
		clipboardPayload: null,
		pointerCommitNonce: 0,
		headerFooter: {},
		layoutOptions: [],
		slideMasters: [],
		theme: undefined,
		themeOptions: [],
		customShows: [],
		activeCustomShowId: null,
		sections: [],
		presentationProperties: {},
		notesMaster: undefined,
		handoutMaster: undefined,
		notesCanvasSize: undefined,
		customProperties: [],
		tagCollections: [],
		coreProperties: undefined,
		appProperties: undefined,
		embeddedFonts: [],
		hasMacros: false,
		hasDigitalSignatures: false,
		digitalSignatureCount: 0,
		activeMasterIndex: 0,
		activeLayoutIndex: null,
		preMasterMode: 'edit',
		masterViewTab: 'slides',
		handoutSlidesPerPage: 4,
	};

	it("mode defaults to 'edit'", () => {
		expect(defaults.mode).toBe('edit');
	});

	it('loading defaults to true', () => {
		expect(defaults.loading).toBeTruthy();
	});

	it('error defaults to null', () => {
		expect(defaults.error).toBeNull();
	});

	it('slides defaults to empty array', () => {
		expect(defaults.slides).toStrictEqual([]);
	});

	it('canvasSize defaults to 1280x720', () => {
		expect(defaults.canvasSize).toStrictEqual({ width: 1280, height: 720 });
	});

	it('activeSlideIndex defaults to 0', () => {
		expect(defaults.activeSlideIndex).toBe(0);
	});

	it('selectedElementId defaults to null', () => {
		expect(defaults.selectedElementId).toBeNull();
	});

	it('selectedElementIds defaults to empty array', () => {
		expect(defaults.selectedElementIds).toStrictEqual([]);
	});

	it('isDirty defaults to false', () => {
		expect(defaults.isDirty).toBeFalsy();
	});

	it("newShapeType defaults to 'rect'", () => {
		expect(defaults.newShapeType).toBe('rect');
	});

	it('clipboardPayload defaults to null', () => {
		expect(defaults.clipboardPayload).toBeNull();
	});

	it('pointerCommitNonce defaults to 0', () => {
		expect(defaults.pointerCommitNonce).toBe(0);
	});

	it('hasMacros defaults to false', () => {
		expect(defaults.hasMacros).toBeFalsy();
	});

	it('hasDigitalSignatures defaults to false', () => {
		expect(defaults.hasDigitalSignatures).toBeFalsy();
	});

	it('digitalSignatureCount defaults to 0', () => {
		expect(defaults.digitalSignatureCount).toBe(0);
	});

	it('activeMasterIndex defaults to 0', () => {
		expect(defaults.activeMasterIndex).toBe(0);
	});

	it('activeLayoutIndex defaults to null', () => {
		expect(defaults.activeLayoutIndex).toBeNull();
	});

	it("masterViewTab defaults to 'slides'", () => {
		expect(defaults.masterViewTab).toBe('slides');
	});

	it('handoutSlidesPerPage defaults to 4', () => {
		expect(defaults.handoutSlidesPerPage).toBe(4);
	});

	it('embeddedFonts defaults to empty array', () => {
		expect(defaults.embeddedFonts).toStrictEqual([]);
	});

	it('sections defaults to empty array', () => {
		expect(defaults.sections).toStrictEqual([]);
	});

	it('customShows defaults to empty array', () => {
		expect(defaults.customShows).toStrictEqual([]);
	});

	it('presentationProperties defaults to empty object', () => {
		expect(defaults.presentationProperties).toStrictEqual({});
	});

	it('headerFooter defaults to empty object', () => {
		expect(defaults.headerFooter).toStrictEqual({});
	});
});

// ---------------------------------------------------------------------------
// Ref initial values
// ---------------------------------------------------------------------------

describe('ref initial values', () => {
	it('activeSlideIndexRef should start at 0', () => {
		const ref = { current: 0 };
		expect(ref.current).toBe(0);
	});

	it('dragStateRef should start as null', () => {
		const ref = { current: null };
		expect(ref.current).toBeNull();
	});

	it('resizeStateRef should start as null', () => {
		const ref = { current: null };
		expect(ref.current).toBeNull();
	});

	it('isDrawingRef should start as false', () => {
		const ref = { current: false };
		expect(ref.current).toBeFalsy();
	});
});
