import type {
	MasterViewTab,
	ParsedTableStyleMap,
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
	PptxSlide,
	PptxThemeColorScheme,
} from 'pptx-viewer-core';
import type {
	CanvasSize,
	ElementClipboardPayload,
	RemoteCursor,
	SanitizedPresence,
} from 'pptx-viewer-shared';
import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_STROKE_COLOR,
} from 'pptx-viewer-shared';

/** `zoom` is either an explicit scale factor (1 = 100%) or fit-to-viewport. */
export type ZoomLevel = number | 'fit';

/**
 * The Draw ribbon tab's active tool. `'select'` means normal editing gestures
 * (move/resize/rotate/inline-edit) apply on the stage; every other value
 * routes stage pointer events to the ink-drawing gesture controller instead
 * (see `editor-draw-gestures.ts`).
 */
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser';

/**
 * The vanilla viewer's reactive view state. Kept intentionally flat and small;
 * everything here is what the DOM render layer consumes.
 */
export interface ViewerState {
	/** Parsed slides (image/media URLs already patched in by the load pipeline). */
	slides: PptxSlide[];
	/** Inherited layout/master elements, separated so interaction can be gated. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	/** Parsed slide masters and layouts used by the dedicated master canvas. */
	slideMasters: PptxSlideMaster[];
	/** Parsed notes master and its portrait page size. */
	notesMaster?: PptxNotesMaster;
	notesCanvasSize?: CanvasSize;
	/** Parsed handout master. */
	handoutMaster?: PptxHandoutMaster;
	/** Whether the loaded package contains a VBA project. */
	hasMacros: boolean;
	/** Active master-workspace tab. */
	masterViewTab: MasterViewTab;
	/** Preview layout used by the handout master workspace. */
	handoutSlidesPerPage: number;
	/** Active master/layout canvas, or null for normal slide view. */
	masterViewTarget: { masterIndex: number; layoutIndex: number | null } | null;
	/** Slide canvas size in CSS pixels. */
	canvasSize: CanvasSize;
	/** Archive-path to displayable URL map for media + poster frames. */
	mediaDataUrls: Map<string, string>;
	/** Presentation theme colours used by scheme-based rendering. */
	colorScheme?: PptxThemeColorScheme;
	/** Parsed presentation table styles keyed by style id. */
	tableStyleMap?: ParsedTableStyleMap;
	/** Zero-based index of the visible slide. */
	currentSlide: number;
	/** Requested zoom (explicit factor or fit-to-viewport). */
	zoom: ZoomLevel;
	/** True while a load is in flight. */
	loading: boolean;
	/** Error message from the last failed load, or null. */
	error: string | null;
	/** True while presentation (fullscreen) mode is active. */
	presenting: boolean;
	/** True when editing interactions (select/move/resize/...) are enabled. */
	editable: boolean;
	/** Id of the selected element on the current slide, or null. */
	selectedElementId: string | null;
	/** All selected top-level element ids; the primary selection is listed last. */
	selectedElementIds: string[];
	/** Source element id while the one-shot Format Painter is armed. */
	formatPainterSourceId: string | null;
	/** When true, selection and element mutations target inherited template elements. */
	editTemplateMode: boolean;
	/** True when the document has unsaved edits (cleared by a save). */
	dirty: boolean;
	/**
	 * True while a pointer gesture (drag/resize/rotate) is in flight. Thumbnail
	 * re-renders are deferred until the gesture ends.
	 */
	interactionActive: boolean;
	/**
	 * True when the speaker-notes panel body is expanded. Persists across slide
	 * navigation for the life of the viewer instance (in-memory only).
	 */
	notesExpanded: boolean;
	/** Remote collaborators currently in the session (empty when not collaborating). */
	remotePresences: SanitizedPresence[];
	/** Remote cursors visible on the current slide, projected from `remotePresences`. */
	cursors: RemoteCursor[];
	/** Client id of the peer the local user is following, or null when free. */
	followedClientId: number | null;
	/** In-memory clipboard payload from the last copy/cut, or null. */
	clipboardPayload: ElementClipboardPayload | null;
	/** Active Draw ribbon tool; `'select'` disables the ink-drawing gesture controller. */
	drawTool: DrawTool;
	/** Stroke colour for the pen/highlighter tools. */
	drawColor: string;
	/** Stroke width (px) for the pen/highlighter tools. */
	drawWidth: number;
}

export function createInitialViewerState(): ViewerState {
	return {
		slides: [],
		templateElementsBySlideId: {},
		slideMasters: [],
		notesMaster: undefined,
		notesCanvasSize: undefined,
		handoutMaster: undefined,
		hasMacros: false,
		masterViewTab: 'slides',
		handoutSlidesPerPage: 4,
		masterViewTarget: null,
		canvasSize: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
		mediaDataUrls: new Map(),
		colorScheme: undefined,
		tableStyleMap: undefined,
		currentSlide: 0,
		zoom: 'fit',
		loading: false,
		error: null,
		presenting: false,
		editable: false,
		selectedElementId: null,
		selectedElementIds: [],
		formatPainterSourceId: null,
		editTemplateMode: false,
		dirty: false,
		interactionActive: false,
		notesExpanded: false,
		remotePresences: [],
		cursors: [],
		followedClientId: null,
		clipboardPayload: null,
		drawTool: 'select',
		drawColor: DEFAULT_STROKE_COLOR,
		drawWidth: 3,
	};
}

/** Clamp a slide index into the valid range for the given slide count. */
export function clampSlideIndex(index: number, slideCount: number): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}
