import type {
	MasterViewTab,
	ParsedTableStyleMap,
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxCustomShow,
	PptxEmbeddedFont,
	PptxElement,
	PptxHandoutMaster,
	PptxHeaderFooter,
	PptxNotesMaster,
	PptxPresentationProperties,
	PptxSection,
	PptxSlideMaster,
	PptxSlide,
	PptxTagCollection,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemeOption,
	PptxViewProperties,
} from 'pptx-viewer-core';
import type {
	CanvasSize,
	CompatibilityWarningToast,
	ElementClipboardPayload,
	InlineTextSelection,
	Guide,
	ReadOnlyRecommendation,
	RemoteCursor,
	SanitizedPresence,
	SlideSizeEmu,
} from 'pptx-viewer-shared';
import {
	DEFAULT_CANVAS_HEIGHT,
	DEFAULT_CANVAS_WIDTH,
	DEFAULT_STROKE_COLOR,
} from 'pptx-viewer-shared';

import type { ChartPartSelection } from '../render';

/** `zoom` is either an explicit scale factor (1 = 100%) or fit-to-viewport. */
export type ZoomLevel = number | 'fit';

/**
 * The Draw ribbon tab's active tool. `'select'` means normal editing gestures
 * (move/resize/rotate/inline-edit) apply on the stage; every other value
 * routes stage pointer events to the ink-drawing gesture controller instead
 * (see `editor-draw-gestures.ts`).
 */
export type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

/**
 * The vanilla viewer's reactive view state. Kept intentionally flat and small;
 * everything here is what the DOM render layer consumes.
 */
export interface ViewerState {
	/** Parsed slides (image/media URLs already patched in by the load pipeline). */
	slides: PptxSlide[];
	/** Presentation sections used to group slides in the thumbnail rail. */
	sections: PptxSection[];
	presentationProperties: PptxPresentationProperties;
	/**
	 * View properties (`ppt/viewProps.xml`, `p:viewPr`): grid spacing, snap /
	 * guide toggles, last view, splitter state, etc. `gridSpacing` lives here,
	 * NOT on `presentationProperties` -- `p:gridSpacing` is a child of
	 * `p:viewPr`, and a real PowerPoint file never populates it under
	 * `p:presentationPr`.
	 */
	viewProperties: PptxViewProperties | undefined;
	headerFooter: PptxHeaderFooter;
	coreProperties?: PptxCoreProperties;
	appProperties?: PptxAppProperties;
	customProperties: PptxCustomProperty[];
	customShows: PptxCustomShow[];
	/**
	 * The custom show a started slide show is restricted to, or null for the
	 * whole deck. Custom shows were definable here but nothing could select one,
	 * so picking a show had no effect on what actually presented; this is the
	 * state the show-order rule needs to honour membership (React, Vue and
	 * Angular each hold the same id).
	 */
	activeCustomShowId: string | null;
	embeddedFonts: PptxEmbeddedFont[];
	/**
	 * File > Fonts > "Embed fonts in the file". Read by the save path, which
	 * hands it to the shared `embeddedFontSaveOptions`: off passes
	 * `embeddedFontList: null` and strips `p:embeddedFontLst`, the `/font`
	 * relationships and the `.fntdata` parts, while on leaves core's lossless
	 * re-embed alone. Seeded per load from {@link embeddedFonts} (see
	 * `describeFontEmbedding`), because a deck that arrived with embedded fonts
	 * keeps them on save and the switch has to say so. It used to be a private
	 * field on `PptxViewer` that nothing downstream read, so moving it produced a
	 * byte-identical file.
	 */
	embedFonts: boolean;
	hasDigitalSignatures: boolean;
	digitalSignatureCount: number;
	isPasswordProtected: boolean;
	/**
	 * The File > Info > Protect Presentation secret, or null when the deck saves
	 * in the clear. Read by the save path and handed to the shared
	 * `planDeckSave`, which routes a protected save through `saveEncrypted` so
	 * the produced file is an encrypted OLE2 container, not a plain ZIP.
	 * Deliberately separate from {@link isPasswordProtected}, which the LOAD
	 * pipeline also sets for a deck that merely arrived protected.
	 */
	presentationPassword: string | null;
	/** Inherited layout/master elements, separated so interaction can be gated. */
	templateElementsBySlideId: Record<string, PptxElement[]>;
	/** Parsed slide masters and layouts used by the dedicated master canvas. */
	slideMasters: PptxSlideMaster[];
	/** Theme parts discovered in the package (inspector THEME card). */
	themeOptions: PptxThemeOption[];
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
	/**
	 * The deck's `p:sldSz` in EMU, seeded from the parse and re-written by the
	 * inspector's Slide Size preset / orientation controls.
	 *
	 * Held alongside {@link canvasSize} rather than derived from it because the
	 * pixel size is lossy: Ledger is 12179300 EMU (1278.5px), so a round-trip
	 * through an integer pixel would move it 6350 EMU and cost the deck its
	 * `ppSlideSizeLedgerPaper` identity. `resolveSlideSizeSelection` decides
	 * which of the two wins at save time.
	 */
	slideSize?: SlideSizeEmu;
	/** Archive-path to displayable URL map for media + poster frames. */
	mediaDataUrls: Map<string, string>;
	/** Presentation theme colours used by scheme-based rendering. */
	colorScheme?: PptxThemeColorScheme;
	/** Presentation theme fonts used by table-style font resolution. */
	fontScheme?: PptxThemeFontScheme;
	/** The loaded theme's name (inspector THEME EDITOR card). */
	themeName?: string;
	/**
	 * Families the user registered from a local font file this session
	 * (File > Options > Fonts, off by default).
	 *
	 * Session state, never persisted and never written into the deck: the font
	 * binary is the user's, not ours to store.
	 */
	customFontFamilies: string[];
	/** Tag collections parsed from `ppt/tags/*.xml` (inspector TAGS card). */
	tagCollections: PptxTagCollection[];
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
	/**
	 * True once the show has run past its last slide and the black "End of slide
	 * show" screen is up. It MUST be surfaced: while it is up the next input
	 * either goes nowhere (backward) or ends the show (forward), so a deck that
	 * kept painting its last slide looked stuck and swallowed every advance.
	 */
	endOfShow: boolean;
	/**
	 * True for a single render pass when the show stepped BACKWARD onto the
	 * current slide, so its builds are seeded already-complete (PowerPoint).
	 */
	enteringBackward?: boolean;
	/** True when editing interactions (select/move/resize/...) are enabled. */
	editable: boolean;
	/**
	 * True while a freshly-opened deck is held read-only by Trust Center >
	 * "Open documents in Protected View" (see `shouldOpenInProtectedView`).
	 * While set, `editable` is forced off regardless of the host's own
	 * `editable` option; the "Enable Editing" banner clears it for the session.
	 */
	protectedView: boolean;
	/** Id of the selected element on the current slide, or null. */
	selectedElementId: string | null;
	/** All selected top-level element ids; the primary selection is listed last. */
	selectedElementIds: string[];
	/** Active table cell for cell-scoped inspector formatting. */
	selectedTableCell: { row: number; column: number } | null;
	/** Shift-select range of active table cells, including the anchor. */
	selectedTableCells: Array<{ row: number; column: number }>;
	/** Active rich-text range captured from the inline editor. */
	selectedTextRange: InlineTextSelection | null;
	/**
	 * On-canvas chart part selection (a clicked bar/dot/slice/series line),
	 * surfaced to the chart inspector's data grid + point-index picker. Cleared
	 * whenever the general element selection changes (see `selectionState`).
	 */
	chartPartSelection: ChartPartSelection | null;
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
	/** True when the right-hand property inspector panel is shown (editing chrome). */
	inspectorOpen: boolean;
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
	showGrid: boolean;
	showRulers: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	/**
	 * Whether the drawing guides are painted on the stage (View > Guides).
	 *
	 * Visibility only: `guides` keeps the full list either way, so hiding them
	 * neither drops a guide from the saved deck nor stops a drag snapping to
	 * one. Guide visibility and shape snapping are separate settings and each
	 * has its own View-tab control.
	 */
	showGuides: boolean;
	guides: Guide[];
	eyedropperActive: boolean;
	spellCheckEnabled: boolean;
	/**
	 * Whether the loaded deck recommends opening read-only (`p:modifyVerifier`
	 * or `docProps/custom.xml`'s "Mark as Final"), and why; null when it does
	 * not. See `readOnlyRecommendation` in `pptx-viewer-shared`. Reset on every
	 * load.
	 */
	readOnlyRecommendation: ReadOnlyRecommendation | null;
	/**
	 * Whether the read-only recommendation banner has been closed for this
	 * load, by either "Edit anyway" or the plain dismiss button. Independent
	 * from whether editing is actually locked: "Dismiss" hides the banner but
	 * keeps the lock, only "Edit anyway" lifts it too.
	 */
	readOnlyBannerDismissed: boolean;
	/**
	 * Compatibility-warning toasts for the current load (deck-level
	 * `data.warnings` concatenated with every slide's own `warnings`, deduped
	 * by code through the shared `compatibilityWarningToasts`). Load
	 * diagnostics, not auto-hiding; cleared on the next load. Dismissing a
	 * toast (or all of them) removes it from this list.
	 */
	compatToasts: CompatibilityWarningToast[];
}

export function createInitialViewerState(): ViewerState {
	return {
		slides: [],
		sections: [],
		presentationProperties: {},
		viewProperties: undefined,
		headerFooter: {},
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		customShows: [],
		activeCustomShowId: null,
		embeddedFonts: [],
		embedFonts: true,
		customFontFamilies: [],
		hasDigitalSignatures: false,
		digitalSignatureCount: 0,
		isPasswordProtected: false,
		presentationPassword: null,
		templateElementsBySlideId: {},
		slideMasters: [],
		themeOptions: [],
		notesMaster: undefined,
		notesCanvasSize: undefined,
		handoutMaster: undefined,
		hasMacros: false,
		masterViewTab: 'slides',
		handoutSlidesPerPage: 4,
		masterViewTarget: null,
		canvasSize: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
		slideSize: undefined,
		mediaDataUrls: new Map(),
		colorScheme: undefined,
		fontScheme: undefined,
		themeName: undefined,
		tagCollections: [],
		tableStyleMap: undefined,
		currentSlide: 0,
		zoom: 'fit',
		loading: false,
		error: null,
		presenting: false,
		endOfShow: false,
		enteringBackward: false,
		editable: false,
		protectedView: false,
		selectedElementId: null,
		selectedElementIds: [],
		selectedTableCell: null,
		selectedTableCells: [],
		selectedTextRange: null,
		chartPartSelection: null,
		formatPainterSourceId: null,
		editTemplateMode: false,
		dirty: false,
		interactionActive: false,
		notesExpanded: false,
		inspectorOpen: true,
		remotePresences: [],
		cursors: [],
		followedClientId: null,
		clipboardPayload: null,
		drawTool: 'select',
		drawColor: DEFAULT_STROKE_COLOR,
		drawWidth: 3,
		showGrid: false,
		showRulers: false,
		snapToGrid: false,
		snapToShape: true,
		showGuides: true,
		guides: [],
		eyedropperActive: false,
		spellCheckEnabled: false,
		readOnlyRecommendation: null,
		readOnlyBannerDismissed: false,
		compatToasts: [],
	};
}

/** Clamp a slide index into the valid range for the given slide count. */
export function clampSlideIndex(index: number, slideCount: number): number {
	if (slideCount <= 0) {
		return 0;
	}
	return Math.min(Math.max(Math.trunc(index), 0), slideCount - 1);
}
