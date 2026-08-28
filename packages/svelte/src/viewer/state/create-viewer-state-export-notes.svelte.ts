import type { TextSegment } from 'pptx-viewer-core';
import type { FieldSubstitutionContext, MobileSheetKey } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';
import type { EditorState } from '../editor/editor-state.svelte';
import { ExportUiState } from '../export/export-ui.svelte';
import { createExportWiring } from '../export/export-wiring.svelte';
import type { ExportWiring } from '../export/export-wiring.svelte';
import { buildDeckExportData } from './deck-export-data';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface ExportNotesClusterDeps {
	editor: EditorState;
	loader: PresentationLoader;
	viewer: ViewerState;
	t: Translator;
	getSmartArt3D(): boolean;
	getSurfaceChart3D(): boolean;
	getBarChart3D(): boolean;
	getLineChart3D(): boolean;
	getAreaChart3D(): boolean;
	getPieChart3D(): boolean;
	/**
	 * Options > Advanced > "Default resolution" / "Do not compress images"
	 * raster-scale multiplier (see `resolveImageResolutionScale` in
	 * `pptx-viewer-shared`).
	 */
	getImageResolutionScale(): number;
	/** Options > Advanced > "Print hidden slides". */
	getIncludeHiddenSlides(): boolean;
	/** Options > Advanced > "High quality" raster scale for the print fallback path. */
	getPrintHighQuality(): boolean;
	getRootEl(): HTMLDivElement | undefined;
	/** Whether in-place editing is on (gates whether notes edits are history-tracked). */
	getEditable(): boolean;
	/**
	 * Deck-level field-substitution context, so an exported slide resolves its
	 * slide-number / date / footer runs exactly like the on-screen stage does.
	 */
	getFieldContext?(): FieldSubstitutionContext;
	/** Host-supplied source file name, used to name the deck-JSON download. */
	getFileName?(): string | undefined;
	onnotesupdate?: (notes: string) => void;
}

export interface ExportNotesCluster {
	exportWiring: ExportWiring;
	exportUi: ExportUiState;
	readonly notesExpanded: boolean;
	readonly activeMobileSheet: MobileSheetKey;
	onNotesToggle(): void;
	setActiveMobileSheet(next: MobileSheetKey): void;
	onNotesCommit(notes: string, segments?: TextSegment[]): void;
}

/**
 * PNG/PDF/GIF/video/print export wiring + the speaker-notes / mobile
 * action-sheet toggle state. Split out of `createViewerState` to keep that
 * file under the repo's file-size budget; grouped together because both are
 * "output" concerns with no further downstream dependents in this module.
 */
export function buildExportNotesCluster(deps: ExportNotesClusterDeps): ExportNotesCluster {
	const { editor, loader, viewer } = deps;

	const exportWiring = createExportWiring({
		getContainer: deps.getRootEl,
		getSlides: () => editor.renderedSlides,
		getCanvasSize: () => loader.canvasSize,
		getMediaDataUrls: () => loader.mediaDataUrls,
		getCurrent: () => viewer.current,
		getTranslator: () => deps.t,
		getSmartArt3D: deps.getSmartArt3D,
		getSurfaceChart3D: deps.getSurfaceChart3D,
		getBarChart3D: deps.getBarChart3D,
		getLineChart3D: deps.getLineChart3D,
		getAreaChart3D: deps.getAreaChart3D,
		getPieChart3D: deps.getPieChart3D,
		getImageResolutionScale: deps.getImageResolutionScale,
		getIncludeHiddenSlides: deps.getIncludeHiddenSlides,
		getPrintHighQuality: deps.getPrintHighQuality,
		getFieldContext: () => deps.getFieldContext?.(),
		getDeckData: () => buildDeckExportData(editor, loader),
		getFileName: () => deps.getFileName?.(),
	});
	const exportUi = new ExportUiState({
		controller: exportWiring.controller,
		getTranslator: () => deps.t,
	});

	let notesExpanded = $state(false);
	let activeMobileSheet = $state<MobileSheetKey>(null);
	function onNotesToggle(): void {
		notesExpanded = !notesExpanded;
		activeMobileSheet = notesExpanded ? 'notes' : null;
	}
	function setActiveMobileSheet(next: MobileSheetKey): void {
		if (next === 'notes') {
			notesExpanded = true;
		} else if (activeMobileSheet === 'notes') {
			notesExpanded = false;
		}
		activeMobileSheet = next;
	}
	function onNotesCommit(notes: string, segments?: TextSegment[]): void {
		if (deps.getEditable()) {
			editor.commitNotes(notes, segments);
		}
		deps.onnotesupdate?.(notes);
	}

	return {
		exportWiring,
		exportUi,
		get notesExpanded() {
			return notesExpanded;
		},
		get activeMobileSheet() {
			return activeMobileSheet;
		},
		onNotesToggle,
		setActiveMobileSheet,
		onNotesCommit,
	};
}
