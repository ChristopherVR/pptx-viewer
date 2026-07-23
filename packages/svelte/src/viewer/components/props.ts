import type {
	PptxElement,
	PptxSection,
	PptxSlide,
	ShapeStyle,
	TextSegment,
} from 'pptx-viewer-core';
import type {
	CanvasSize,
	ElementAnimationState,
	RenderParagraph,
	ResizeHandleId,
	SnapLine,
	ToolbarActionId,
} from 'pptx-viewer-shared';

import type { EditorController } from '../editor/editor-controller.svelte';
import type { EditorMarqueeRect } from '../editor/editor-selection-gestures';
import type { EditorState } from '../editor/editor-state.svelte';
import type { OverlayBox } from '../editor/types';
import type { ExportUiState } from '../export/export-ui.svelte';
import type { AutosaveStatus } from '../state/autosave.svelte';

/**
 * Prop contracts for the internal viewer components. Kept in a plain `.ts`
 * module (not inside the SFCs) per repo convention: SFCs stay thin
 * presentation, logic and types live in lintable TypeScript files.
 */

/** Props shared by every element-level renderer. */
export interface ElementRendererProps {
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	/**
	 * True only on the live presentation stage (the viewer's fullscreen
	 * surface): media elements should then autoplay, as PowerPoint does when a
	 * slide with media becomes active, rather than waiting for a manual click.
	 * Defaults to `false` (the main windowed canvas and thumbnail rail never
	 * autoplay).
	 */
	presenting?: boolean;
	/**
	 * True only on the main (interactive) canvas, never the thumbnail rail.
	 * Marks the rendered root node with `data-pptx-element="true"` (the
	 * framework-neutral e2e test hook React/Vue/Angular also emit) for the
	 * element types that render their own wrapper directly (group, text/shape).
	 * Defaults to `false`.
	 */
	interactive?: boolean;
	/** Whether inherited layout/master nodes participate in pointer editing. */
	editTemplateMode?: boolean;
	/**
	 * The enclosing group's fill (`GroupPptxElement.groupFill`), passed down by a
	 * group's render branch so a child painted with `a:grpFill`
	 * (`fillMode === 'group'`) inherits the group's resolved fill.
	 */
	parentGroupFill?: ShapeStyle;
	/**
	 * Native-animation playback state for this element, present only during a
	 * running presentation. Drives the staged chart / SmartArt build reveal and
	 * the `p:animClr` fill / stroke relinquish; mirrors React's / Vue's
	 * per-element `animationState`. Absent (undefined) in editor / read-only
	 * rendering (element renderers read it from the element-states context, so it
	 * is optional here and defaulted per renderer).
	 */
	animationState?: ElementAnimationState;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
}

export interface TextBlockProps {
	paragraphs: RenderParagraph[];
	/** Inline `style` string for the text block wrapper. */
	textStyle: string;
}

export interface SlideStageProps {
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	scale?: number;
	/** Forwarded to each `ElementRenderer`; see `ElementRendererProps.presenting`. */
	presenting?: boolean;
	/**
	 * True only for the main (interactive) canvas, never the thumbnail rail.
	 * Adds `role="region" aria-roledescription="slide"` to the stage itself
	 * (the framework-neutral e2e hook React/Vue/Angular also emit) and is
	 * forwarded to each `ElementRenderer`; see `ElementRendererProps.interactive`.
	 */
	interactive?: boolean;
	editTemplateMode?: boolean;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
}

export interface SlideCanvasProps {
	slide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	/** Effective scale (fit-to-viewport x user zoom), pre-computed by the host. */
	scale: number;
	/** True only on the live presentation stage; see `SlideStageProps.presenting`. */
	presenting?: boolean;
	/** True while in-place editing is available; gates the pointer handlers and the editing cursor/class. */
	editingActive?: boolean;
	editTemplateMode?: boolean;
	ontablecellcommit?: (
		elementId: string,
		rowIndex: number,
		cellIndex: number,
		text: string,
	) => void;
	onsmartartnodecommit?: (elementId: string, nodeId: string, text: string) => void;
	onsmartartnodefill?: (elementId: string, nodeId: string, fill: string) => void;
	/** Reports the stage-holder node to the host on mount/teardown (editing hit-surface, export capture anchor). */
	onstageholder?: (el: HTMLDivElement | null) => void;
	onstagepointerdown?: (event: PointerEvent) => void;
	onstagepointermove?: (event: PointerEvent) => void;
	onstagedblclick?: (event: MouseEvent) => void;
	onstagecontextmenu?: (event: MouseEvent) => void;
	/** Fired on any stage click; the host wires this to advance presentation playback. */
	onstageclick?: (event: MouseEvent) => void;
	/**
	 * True while the AI panel is picking an element: the next element click(s)
	 * become the assistant's focus (highlighted) instead of selecting / editing.
	 */
	aiPickMode?: boolean;
	/**
	 * True while a running AI tool is active: the stage marks itself
	 * `data-pptx-ai-active` so element colour changes tween while the assistant
	 * works (see AiFocusHighlightOverlay's tween rule).
	 */
	aiActive?: boolean;
	/** Route a picked canvas element to the AI focus (pick mode only). */
	onaipickelement?: (elementId: string) => void;
	/**
	 * Overlay content layered above the slide (selection/editor layer, ink
	 * drawing, alignment guides, presentation annotations, collaboration
	 * cursors, transition overlay, ...). Rendered inside the same
	 * fixed-size, scaled stage-holder as the slide itself. Kept out of this
	 * component's own props (rather than a fixed list of overlay slots) so it
	 * stays free of the live editor/controller instances those overlays need.
	 */
	children?: import('svelte').Snippet;
}

export interface ViewerToolbarProps {
	/** Active slide (0-based). */
	current: number;
	total: number;
	/** Currently-effective zoom percent (rounded). */
	zoomPercent: number;
	isFullscreen: boolean;
	onprev: () => void;
	onnext: () => void;
	onzoomin: () => void;
	onzoomout: () => void;
	onzoomfit: () => void;
	onfullscreen: () => void;
	/** Whether the Notes toggle button is shown (host has a notes panel). */
	showNotes?: boolean;
	/** Whether the notes panel is currently expanded (drives the pressed state). */
	notesExpanded?: boolean;
	onnotestoggle?: () => void;
	/** Show the editing action group (Undo / Redo / Save). Default false. */
	editable?: boolean;
	/** Whether an undo step is available (drives the Undo button's disabled state). */
	canUndo?: boolean;
	/** Whether a redo step is available (drives the Redo button's disabled state). */
	canRedo?: boolean;
	/** Whether there are unsaved edits (drives the Save button's emphasis). */
	dirty?: boolean;
	onundo?: () => void;
	onredo?: () => void;
	onsave?: () => void;
	ondownload?: () => void;
	/**
	 * Autosave lifecycle status; when set (host opted into `autosave`) a small
	 * status pill renders in the editing group. Omit to hide the pill entirely.
	 */
	autosaveStatus?: AutosaveStatus;
	/** Whether there are unsaved autosave edits (drives the pill's "dirty" tone). */
	autosaveDirty?: boolean;
	/**
	 * Export menu state (PNG / PDF / GIF / video / print). When set, the
	 * toolbar renders the `ExportMenu` dropdown in its right-hand group,
	 * matching the export affordance the React/Vue/Angular chrome exposes.
	 * Omit to hide the menu (e.g. while no presentation is loaded).
	 */
	exportUi?: ExportUiState;
	/** Opens the Share (collaboration) dialog. Omit to hide the button. */
	onshare?: () => void;
	/** Opens the Broadcast dialog. Omit to hide the button. */
	onbroadcast?: () => void;
	/** Whether a collaboration session is currently active (highlights the Share button). */
	collabActive?: boolean;
	/** Toolbar buttons to hide; see `PowerPointViewerProps.hiddenActions`. Default undefined: nothing hidden. */
	hiddenActions?: ToolbarActionId[];
}

/** Props for the selection overlay (box + 8 resize handles + rotate handle). */
export interface SelectionOverlayProps {
	/** Selection box in element (unscaled slide) px, or null to hide it. */
	box: OverlayBox | null;
	/** Stage scale (screen px per element px) applied when positioning. */
	scale: number;
	/** Transient snap-alignment lines (element px). */
	snapLines: readonly SnapLine[];
	/** Hide the box/handles while the inline text editor is open. */
	editing?: boolean;
	/** Number of selected elements; collective boxes do not expose rotation. */
	selectionCount?: number;
	/** In-progress empty-canvas marquee rectangle. */
	marquee?: EditorMarqueeRect | null;
	onhandlepointerdown: (handle: ResizeHandleId, event: PointerEvent) => void;
	onrotatepointerdown: (event: PointerEvent) => void;
}

/** Props for the inline (double-click) text editing surface. */
export interface InlineTextEditorProps {
	/** The element being edited (seeds the initial text + font hints). */
	element: PptxElement;
	/** The element's box in element px (positioning). */
	box: OverlayBox;
	/** Stage scale (screen px per element px). */
	scale: number;
	spellCheck?: boolean;
	/** Called with the edited plain text on every keystroke (live preview only). */
	oninput?: (text: string) => void;
	/** Called with the edited plain text on commit (only when it changed). */
	oncommit: (text: string) => void;
	/** Called after the surface closes (commit or cancel). */
	onclose: () => void;
}

/** Props for the editing layer (selection overlay + inline editor over the stage). */
export interface EditorLayerProps {
	/** The reactive editing orchestrator (owns overlay/snap/inline state). */
	controller: EditorController;
	/** Stage scale (screen px per element px). */
	scale: number;
	spellCheck?: boolean;
}

/** Position and callbacks for the editable element context menu. */
export interface ElementContextMenuProps {
	x: number;
	y: number;
	editor: EditorState;
	/** "Ask AI about this" action (shown only when the host enables the `ai` prop). */
	onaskai?: () => void;
	/** "Fix with AI" action (shown only when the host enables the `ai` prop). */
	onfixai?: () => void;
	onclose: () => void;
}

export interface ThumbnailRailProps {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	current: number;
	onselect: (index: number) => void;
	/** Enables native thumbnail drag-and-drop slide reordering. */
	editable?: boolean;
	onmove?: (fromIndex: number, toIndex: number) => void;
	/**
	 * Inserts a new blank slide (React's sidebar "+ Add Slide" button). The
	 * button is pinned below the scrollable list and only renders while
	 * `editable` is set and this callback is provided.
	 */
	onaddslide?: () => void;
	sections?: PptxSection[];
	onsectiontoggle?: (sectionId: string) => void;
	onsectionrename?: (sectionId: string, name: string) => void;
	onsectiondelete?: (sectionId: string) => void;
	onsectionmove?: (sectionId: string, direction: 'up' | 'down') => void;
}

export interface NotesPanelProps {
	/** Active slide; the panel reads/edits its plain-text speaker notes. */
	slide: PptxSlide | undefined;
	/**
	 * Whether the panel body is expanded. Controlled by the host so the
	 * toolbar's Notes toggle and the panel's own header stay in sync.
	 */
	expanded?: boolean;
	/**
	 * Called with the committed plain-text notes (on `change` / `blur`) when
	 * the user edits the textarea. This binding has no built-in slide-mutation
	 * channel, so omit this to render a read-only panel; when provided, the
	 * host is responsible for writing the text back onto the slide. Mirrors
	 * the Vue notes panel's plain-text `update` emit contract.
	 */
	onupdate?: (notes: string, segments?: TextSegment[]) => void;
	/** Called when the header is clicked to expand/collapse the panel. */
	ontoggle?: () => void;
}
