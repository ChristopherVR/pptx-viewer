import type { PptxSlide } from 'pptx-viewer-core';
import type { CanvasSize, ViewerTheme } from 'pptx-viewer-shared';

import type { FindReplaceState } from '../../editor/editor-find-replace.svelte';
import type { EditorState } from '../../editor/editor-state.svelte';
import type { ExportUiState } from '../../export/export-ui.svelte';
import type { AutosaveStatus } from '../../state/autosave.svelte';

/**
 * Prop contracts for the ribbon shell and its tabs. Kept in a plain `.ts`
 * module per repo convention: SFCs stay thin presentation, types live in
 * lintable TypeScript files.
 */

export interface RibbonProps {
	/** History-tracked editor state; Home/Insert tab groups read/write it directly. */
	editor: EditorState;
	/** Reactive Find & Replace panel state, owned by the host so it can navigate the viewer. */
	findReplace: FindReplaceState;
	/** Slide canvas size (px); the Insert tab centres new charts/media/SmartArt/etc. on it. */
	canvasSize: CanvasSize;

	/** Compact nav row (always visible): active slide (0-based) / total. */
	current: number;
	total: number;
	onprev: () => void;
	onnext: () => void;
	/** Move the viewer to a specific slide index (the Home tab's Slides group). */
	onnavigateslide: (index: number) => void;

	/** Primary row: undo/redo/save/download + autosave pill. */
	canUndo: boolean;
	canRedo: boolean;
	dirty: boolean;
	onundo: () => void;
	onredo: () => void;
	onsave: () => void;
	ondownload: () => void;
	ondownloadppsx: () => void;
	ondownloadpptm: () => void;
	onpackage: () => void;
	hasMacros: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveDirty?: boolean;

	/** Collaboration entry points, kept in the primary row like React's chrome. */
	onshare?: () => void;
	onbroadcast?: () => void;
	collabActive?: boolean;
	/** Slide Show tab actions: enter presentation from slide 0 or the current slide. */
	onfrombeginning: () => void;
	onfromcurrent: () => void;
	onpresenter: () => void;

	/** Review tab: presentation-wide accessibility audit and issue navigation. */
	slides: readonly PptxSlide[];
	onnavigatetoissue: (slideIndex: number, elementId?: string) => void;

	/** View tab: zoom / fullscreen / notes toggle. */
	zoomPercent: number;
	onzoomin: () => void;
	onzoomout: () => void;
	onzoomfit: () => void;
	isFullscreen: boolean;
	onfullscreen: () => void;
	showNotes?: boolean;
	notesExpanded?: boolean;
	onnotestoggle?: () => void;
	/** Opens the dedicated slide-master and layout navigation workspace. */
	onentermasterview?: () => void;

	/** File tab: export menu (PNG / PDF / GIF / video / print). */
	exportUi?: ExportUiState;
	onopenfile?: () => void;

	/**
	 * Design tab: the current effective viewer-chrome theme (for highlighting
	 * the active swatch) and the setter its gallery calls to switch presets.
	 */
	theme: ViewerTheme | undefined;
	onsettheme: (theme: ViewerTheme | undefined) => void;
}
