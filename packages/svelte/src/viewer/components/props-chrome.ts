import type { PptxSection, PptxSlide, PptxTextStyleLevels, TextSegment } from 'pptx-viewer-core';
import type { CanvasSize, ToolbarActionId } from 'pptx-viewer-shared';

import type { ExportUiState } from '../export/export-ui.svelte';
import type { AutosaveStatus } from '../state/autosave.svelte';

/**
 * Prop contracts for the viewer chrome around the canvas: the compact
 * toolbar, the thumbnail rail, and the speaker-notes panel. Split out of
 * `props.ts` for the repo's file-size budget; import them from `./props`,
 * which re-exports this module.
 */

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
	/**
	 * The deck's notes master `<p:notesStyle>` defaults (`PptxData.notesMaster.
	 * notesStyle`), when the host has it. Fills in a seeded segment's missing
	 * font size/family/weight/style/colour/indent from the level-0 (or
	 * `a:defPPr` fallback) resolved style, without overriding any value the
	 * segment already carries explicitly. Omit when unavailable; behaviour is
	 * unchanged (falls back to this binding's own hardcoded look).
	 */
	notesStyle?: PptxTextStyleLevels;
}
