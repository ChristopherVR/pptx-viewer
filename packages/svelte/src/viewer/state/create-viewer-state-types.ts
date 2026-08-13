import type { PptxSaveFormat, TextSegment } from 'pptx-viewer-core';
import type {
	AutosaveDisabledReason,
	CanvasSize,
	CollaborationConfig,
	FieldSubstitutionContext,
	MobileSheetKey,
	ViewerMode,
} from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';
import type { CollaborationController, CollaborationDialogsState } from '../collab';
import type { ShareDefaultsInput } from '../collab/collaboration-dialogs.svelte';
import type { StageContextMenu } from '../components/props';
import type { DeckApi } from '../editor/deck-api';
import type { EditingApi } from '../editor/editing-api';
import type { EditorController } from '../editor/editor-controller.svelte';
import type { FindReplaceState } from '../editor/editor-find-replace.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import type { ExportUiState } from '../export/export-ui.svelte';
import type { ExportWiring } from '../export/export-wiring.svelte';
import type { ExportingApi } from '../export/exporting-api';
import type { PresentationController, PresenterSession } from '../presentation';
import type { ViewerLoadDetail } from '../types';
import type { AutosaveRecoveryController } from './autosave-recovery.svelte';
import type { AutosaveController } from './autosave.svelte';
import type { ChromeUiState } from './chrome-ui.svelte';
import type { AiCluster } from './create-viewer-state-ai.svelte';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerOptionsState } from './viewer-options.svelte';
import type { ViewerParityUiState } from './viewer-parity-ui.svelte';
import type { ViewerState } from './viewer-state.svelte';

export type { CanvasSize };

/**
 * Options accepted by {@link createViewerState}. Mirrors the subset of
 * `PowerPointViewerProps` the extracted construction block (formerly
 * inlined at the top of `PowerPointViewer.svelte`'s `<script>`) closes
 * over, plus getter callbacks for the handful of DOM-bound values
 * (`bind:this` / `bind:clientWidth` targets) that must stay owned by
 * whichever component renders the actual markup.
 */
export interface CreateViewerStateOptions {
	getSource: () => Uint8Array | ArrayBuffer | null | undefined;
	collaboration?: CollaborationConfig;
	shareDefaults?: ShareDefaultsInput;
	/**
	 * Host `autosave` prop, verbatim. `undefined` means the host said nothing,
	 * which PERMITS autosave (the user's toggle then decides); only an explicit
	 * `false` vetoes it and makes the toggle inert. See
	 * `resolveAutosaveActivation` in `pptx-viewer-shared`.
	 */
	getAutosave: () => boolean | undefined;
	autosaveIntervalMs?: number;
	getFilePath: () => string | undefined;
	getInitialSlide: () => number;
	/** Already locale-bound translator; propagated to descendants via context. */
	t: Translator;
	getSmartArt3D: () => boolean;
	/**
	 * The host `editable` prop. The factory mirrors it into its own
	 * {@link ViewerStateBag.editable} flag, which the AI seam, `setMode()` and
	 * Trust Center's Protected View can then flip without the host round-trip.
	 */
	getEditable: () => boolean;
	/** Display file name, used by the AI seam as a friendly deck title. */
	getFileName?: () => string | undefined;
	/** Whether the host enabled the AI assistant (the `ai` prop). */
	getAiEnabled?: () => boolean;

	onload?: (detail: ViewerLoadDetail) => void;
	onerror?: (message: string) => void;
	onslidechange?: (index: number) => void;
	onnotesupdate?: (notes: string) => void;
	onchange?: () => void;
	ondirtychange?: (dirty: boolean) => void;
	oncontentchange?: (content: Uint8Array) => void;
	onmodechange?: (mode: ViewerMode) => void;
	onzoomchange?: (zoom: number) => void;
	onselectionchange?: (elementIds: string[]) => void;
	onslidecountchange?: (count: number) => void;
	onautosave?: (bytes: Uint8Array) => void;
	/** Fired when the host toggles AutoSave (title bar / Settings dialog). */
	onautosavetoggle?: (enabled: boolean) => void;
	onstartcollaboration?: (config: CollaborationConfig) => void;
	onstopcollaboration?: () => void;
	/**
	 * Host override for File > Open > "Browse this device". Without it
	 * {@link ViewerStateBag.openFile} falls back to the built-in native picker
	 * and loads the chosen deck in place, so the control is never inert.
	 */
	onopenfile?: () => void;

	/** DOM-bound getters, supplied by the component that owns the markup. */
	getStageHolderEl: () => HTMLDivElement | undefined;
	getRootEl: () => HTMLDivElement | undefined;
	getViewportWidth: () => number;
	getViewportHeight: () => number;
	/** Master/layout workspace zoom, assigned by `MasterViewBody`. */
	getMasterScale: () => number;
}

/**
 * Everything the ribbon, toolbar, and canvas need, returned from
 * {@link createViewerState}. Reactive/derived fields are exposed as
 * getters (some paired with setters for the plain local UI flags) so reads
 * anywhere, not just inside an `$effect`, stay live.
 */
export interface ViewerStateBag {
	readonly loader: PresentationLoader;
	readonly viewer: ViewerState;
	readonly editor: EditorState;
	readonly controller: EditorController;
	readonly parityUi: ViewerParityUiState;
	readonly chromeUi: ChromeUiState;
	readonly findReplace: FindReplaceState;
	readonly collab: CollaborationController;
	readonly dialogs: CollaborationDialogsState;
	readonly autosaveCtl: AutosaveController;
	/** The "recover unsaved changes?" probe + prompt for the loaded deck. */
	readonly autosaveRecovery: AutosaveRecoveryController;
	readonly presentation: PresentationController;
	readonly presenterSession: PresenterSession;
	readonly exportWiring: ExportWiring;
	readonly exportUi: ExportUiState;
	/** The full PowerPoint File > Options model (persisted), provided via context. */
	readonly optionsState: ViewerOptionsState;
	/** AI assistant bridge + on-canvas focus controller + panel open flag. */
	readonly ai: AiCluster;
	readonly t: Translator;
	/** Imperative undo/redo/save/download API, matching `PowerPointViewerApi`'s editing subset. */
	readonly editingApi: EditingApi;
	/** Imperative PNG/PDF/GIF/video/print API, matching `PowerPointViewerApi`'s export subset. */
	readonly exportingApi: ExportingApi;
	/** Imperative navigation/zoom/mode/slide/element API (the rest of `PowerPointViewerApi`). */
	readonly deck: DeckApi;

	/** Effective scale (fit-to-viewport x user zoom), matching the main canvas. */
	readonly scale: number;
	/** User-facing zoom percent (rounded, never below 1). */
	readonly effectivePercent: number;
	readonly displaySlides: EditorState['renderedSlides'];
	readonly activeSlide: EditorState['renderedSlides'][number] | undefined;
	readonly chromeVisible: boolean;
	/** True when in-place editing is actually available (editable, not presenting, not read-only). */
	readonly editingActive: boolean;
	/** True once the ribbon (vs. the compact `ViewerToolbar`) should be shown. */
	readonly showRibbon: boolean;
	readonly viewerMode: ViewerMode;
	/** True while the autosave debounce/write cycle is armed. */
	readonly autosaveActive: boolean;

	/**
	 * The live editable flag: seeded from the host `editable` prop, then
	 * writable so an AI edit, `deck.setMode()` or Trust Center's Protected View
	 * can flip it without waiting on the host.
	 */
	editable: boolean;
	/**
	 * The EFFECTIVE title-bar AutoSave state: the user's preference, or false
	 * when the host vetoed autosave (the switch renders off and inert rather
	 * than pretending to work). Mutate via {@link setAutosaveEnabled}, which
	 * also fires `onautosavetoggle`.
	 */
	readonly autosaveEnabled: boolean;
	/** False only when the host passed `autosave={false}`; the toggle is then inert. */
	readonly autosaveToggleAvailable: boolean;
	/** Why autosave is not running, for a host that wants to explain it. */
	readonly autosaveDisabledReason: AutosaveDisabledReason | undefined;
	setAutosaveEnabled(enabled: boolean): void;
	presenterMode: boolean;
	/** `Date.now()` timestamp of the last `enterPresenterView()` call; the presenter view's elapsed-time display. */
	readonly presenterStartedAt: number;
	stageContextMenu: StageContextMenu | null;
	readonly activeMobileSheet: MobileSheetKey;
	setActiveMobileSheet(next: MobileSheetKey): void;
	readonly notesExpanded: boolean;
	versionHistoryOpen: boolean;
	readonly signatureWarningOpen: boolean;

	enterPresenterView(): void;
	closeSignatureWarning(): void;
	/** File > Open > "Browse this device" (host override, else the native picker). */
	openFile(): void;
	/** Run a Quick Access Toolbar command by catalog id (unknown ids no-op). */
	runQuickAccessCommand(id: string): void;
	/**
	 * Deck-level OOXML field-substitution context (date/time, header/footer,
	 * document properties, plus the active slide's number and title), also
	 * published to descendants via `provideFieldContext`.
	 */
	fieldContext(): FieldSubstitutionContext;
	onNotesToggle(): void;
	onNotesCommit(notes: string, segments?: TextSegment[]): void;
	onFullscreenToggle(): void;
	onFullscreenChange(): void;
	onKeydown(event: KeyboardEvent): void;
	/** PowerPoint navigates a running show on the wheel; inert while editing. */
	onWheel(event: WheelEvent): void;
	downloadPptx(fileName?: string): Promise<void>;
	downloadAs(format: PptxSaveFormat, fileName?: string): Promise<void>;
	/** Tear down every constructed controller (call from the host's `onDestroy`). */
	destroy(): void;
}
