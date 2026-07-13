import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, RenderParagraph, ResizeHandleId, SnapLine } from 'pptx-viewer-shared';

import type { EditorController } from '../editor/editor-controller.svelte';
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
}

/** Position and callbacks for the editable element context menu. */
export interface ElementContextMenuProps {
	x: number;
	y: number;
	editor: EditorState;
	onclose: () => void;
}

export interface ThumbnailRailProps {
	slides: PptxSlide[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	current: number;
	onselect: (index: number) => void;
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
	onupdate?: (notes: string) => void;
	/** Called when the header is clicked to expand/collapse the panel. */
	ontoggle?: () => void;
}
