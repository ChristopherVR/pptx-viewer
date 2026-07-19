import type { PptxSlide } from 'pptx-viewer-core';
import type {
	AccountAuthConfig,
	CanvasSize,
	ToolbarActionId,
	ViewerPreferences,
	ViewerTheme,
} from 'pptx-viewer-shared';

import type { FindReplaceState } from '../../editor/editor-find-replace.svelte';
import type { EditorState } from '../../editor/editor-state.svelte';
import type { ExportUiState } from '../../export/export-ui.svelte';
import type { AutosaveStatus } from '../../state/autosave.svelte';
import type { ChromeUiState } from '../../state/chrome-ui.svelte';

/**
 * Prop contracts for the ribbon shell and its tabs. Kept in a plain `.ts`
 * module per repo convention: SFCs stay thin presentation, types live in
 * lintable TypeScript files.
 */

export interface RibbonProps {
	fileName?: string;
	/** History-tracked editor state; Home/Insert tab groups read/write it directly. */
	editor: EditorState;
	/** Reactive Find & Replace panel state, owned by the host so it can navigate the viewer. */
	findReplace: FindReplaceState;
	/** Slide canvas size (px); the Insert tab centres new charts/media/SmartArt/etc. on it. */
	canvasSize: CanvasSize;

	/** Read-only deck: the full ribbon still renders (React parity) but a
	    read-only badge shows in the primary row and edits are inert. */
	readOnly?: boolean;
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
	onversionhistory: () => void;
	hasMacros: boolean;
	embeddedFontNames: string[];
	hasDigitalSignatures: boolean;
	digitalSignatureCount: number;
	isPasswordProtected: boolean;
	autosaveStatus?: AutosaveStatus;
	autosaveDirty?: boolean;

	/** Collaboration entry points: Share on the tab row, broadcast in the Present dropdown (React parity). */
	onshare?: () => void;
	onbroadcast?: () => void;
	collabActive?: boolean;
	/** Side-panel (slides rail / inspector) open state + toggles for the primary row. */
	chromeUi?: ChromeUiState;
	/** Whether live subtitles are currently enabled (Present dropdown checkmark). */
	subtitlesEnabled?: boolean;
	/** Toggle the AI assistant panel. Only wired when the viewer's `ai` prop is set. */
	onai?: () => void;
	/** Whether the AI assistant panel is currently open (primary-row toggle state). */
	aiActive?: boolean;
	/** Toolbar buttons/ribbon tabs to hide; see `PowerPointViewerProps.hiddenActions`. */
	hiddenActions?: ToolbarActionId[];
	/** Slide Show tab actions: enter presentation from slide 0 or the current slide. */
	onfrombeginning: () => void;
	onfromcurrent: () => void;
	onpresenter: () => void;
	onsetupslideshow: () => void;
	onheaderfooter: () => void;
	oncompare: () => void;
	onshortcuts: () => void;
	onsettings: () => void;
	onprintsettings: () => void;
	onrehearse: () => void;
	onrecordfrombeginning: () => void;
	onrecordfromcurrent: () => void;
	onsubtitles: () => void;
	oncustomshows: () => void;
	onselectionpane: () => void;
	onslidesorter: () => void;
	preferences: ViewerPreferences;
	onpreferenceschange: (preferences: ViewerPreferences) => void;
	showGuides: boolean;
	onshowguideschange: (show: boolean) => void;
	snapToShape: boolean;
	onsnapToShapechange: (enabled: boolean) => void;
	onaddguide: (axis: 'h' | 'v') => void;

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
	onopenrecent?: (key: string) => void;

	/**
	 * Design tab: the current effective viewer-chrome theme (for highlighting
	 * the active swatch) and the setter its gallery calls to switch presets.
	 */
	theme: ViewerTheme | undefined;
	onsettheme: (theme: ViewerTheme | undefined) => void;

	/** File tab > Account: disabled-by-default sign-in hook point. */
	accountAuth?: AccountAuthConfig;
}
