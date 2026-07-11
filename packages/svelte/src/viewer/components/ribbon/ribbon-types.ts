import type { CanvasSize } from 'pptx-viewer-shared';

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
	autosaveStatus?: AutosaveStatus;
	autosaveDirty?: boolean;

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

	/** File tab: export menu (PNG / PDF / GIF / video / print). */
	exportUi?: ExportUiState;
}
