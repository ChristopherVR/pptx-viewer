import type { TextSegment } from 'pptx-viewer-core';
import type { FieldSubstitutionContext, MobileSheetKey } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n/translator';
import type { EditorState } from '../editor/editor-state.svelte';
import { ExportUiState } from '../export/export-ui.svelte';
import { createExportWiring } from '../export/export-wiring.svelte';
import type { ExportWiring } from '../export/export-wiring.svelte';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface ExportNotesClusterDeps {
	editor: EditorState;
	loader: PresentationLoader;
	viewer: ViewerState;
	t: Translator;
	getSmartArt3D(): boolean;
	getRootEl(): HTMLDivElement | undefined;
	/** Whether in-place editing is on (gates whether notes edits are history-tracked). */
	getEditable(): boolean;
	/**
	 * Deck-level field-substitution context, so an exported slide resolves its
	 * slide-number / date / footer runs exactly like the on-screen stage does.
	 */
	getFieldContext?(): FieldSubstitutionContext;
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
		getFieldContext: () => deps.getFieldContext?.(),
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
