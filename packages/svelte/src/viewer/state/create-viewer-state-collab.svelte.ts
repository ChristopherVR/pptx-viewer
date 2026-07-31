import type { PptxSlide } from 'pptx-viewer-core';

import { CollaborationController, CollaborationDialogsState } from '../collab';
import { useCollaborationPresenceEffects } from '../collab/collaboration-presence-effects.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { AutosaveController } from './autosave.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface CollabClusterDeps {
	loader: PresentationLoader;
	viewer: ViewerState;
	editor: EditorState;
	options: CreateViewerStateOptions;
	/**
	 * The live editable flag (not the raw host prop): autosave must disarm the
	 * moment an AI edit or Protected View flips editing, not only when the host
	 * re-renders with a new `editable`.
	 */
	getEditable(): boolean;
}

export interface CollabCluster {
	collab: CollaborationController;
	dialogs: CollaborationDialogsState;
	autosaveCtl: AutosaveController;
	readonly autosaveEnabled: boolean;
	setAutosaveEnabled(enabled: boolean): void;
	/**
	 * Set the flag WITHOUT firing `onautosavetoggle`. The File > Options wiring
	 * needs this: it owns its own (mount-hydration-suppressed) notification, so
	 * routing through {@link setAutosaveEnabled} would double-fire the host
	 * callback on every dialog edit.
	 */
	setAutosaveFlag(enabled: boolean): void;
	readonly autosaveActive: boolean;
	versionHistoryOpen: boolean;
	readonly signatureWarningOpen: boolean;
	closeSignatureWarning(): void;
}

/**
 * Collaboration session/dialogs + autosave + the digital-signature warning
 * gate, split out of `createViewerState` purely to keep that file under the
 * repo's file-size budget. None of this cluster depends on the editing
 * chrome (`parityUi` / `controller` / `findReplace`), so it can be built
 * right after `editor` and handed to that cluster afterwards (`controller`
 * needs `collab.setCursor`).
 *
 * Named `use*` (like this file's `useCollaborationPresenceEffects` call)
 * rather than `build*`: it registers `$effect`s of its own, not just
 * constructs objects.
 */
export function useCollabCluster(deps: CollabClusterDeps): CollabCluster {
	const { loader, viewer, editor, options } = deps;

	function sourceBytes(): Uint8Array | null {
		const source = options.getSource();
		if (!source) {
			return null;
		}
		return source instanceof Uint8Array ? source : new Uint8Array(source);
	}
	const collab = new CollaborationController({
		getSlides: () => editor.renderedSlides,
		applyRemoteSlides: (slides: PptxSlide[]) => editor.applyRemoteSlides(slides),
		getConfig: () => options.collaboration,
		getSourceBytes: sourceBytes,
		getCanvasWidth: () => loader.canvasSize.width,
		getCanvasHeight: () => loader.canvasSize.height,
		onStart: (config) => options.onstartcollaboration?.(config),
		onStop: () => options.onstopcollaboration?.(),
	});
	useCollaborationPresenceEffects({
		collab,
		getCurrentSlide: () => viewer.current,
		getSelectedElementId: () => editor.selectedElementId,
		goTo: (index) => viewer.goTo(index),
	});
	const dialogs = new CollaborationDialogsState(collab, () => options.shareDefaults);

	let versionHistoryOpen = $state(false);
	let signatureWarningOpen = $state(false);
	let signatureWarningAcknowledged = $state(false);
	$effect(() => {
		void loader.loadCount;
		signatureWarningAcknowledged = false;
		signatureWarningOpen = false;
	});
	$effect(() => {
		if (editor.dirty && loader.hasDigitalSignatures && !signatureWarningAcknowledged) {
			signatureWarningOpen = true;
		}
	});
	function closeSignatureWarning(): void {
		signatureWarningAcknowledged = true;
		signatureWarningOpen = false;
	}

	let autosaveEnabled = $state(false);
	$effect(() => {
		autosaveEnabled = options.getAutosave();
	});
	const autosaveActive = $derived(
		deps.getEditable() && autosaveEnabled && Boolean(options.getFilePath()) && !collab.readOnly,
	);
	const autosaveCtl = new AutosaveController({
		getEnabled: () => autosaveActive,
		getIntervalMs: () => options.autosaveIntervalMs ?? 2000,
		getFilePath: options.getFilePath,
		getSlides: () => editor.renderedSlides,
		getSlideMasters: () => editor.slideMasters,
		getNotesMaster: () => editor.notesMaster,
		getHandoutMaster: () => editor.handoutMaster,
		getSections: () => editor.sections,
		getHandler: () => loader.handler,
		getLoadCount: () => loader.loadCount,
		onSaved: (bytes) => options.onautosave?.(bytes),
	});

	return {
		collab,
		dialogs,
		autosaveCtl,
		get autosaveEnabled() {
			return autosaveEnabled;
		},
		setAutosaveEnabled(enabled: boolean): void {
			autosaveEnabled = enabled;
			options.onautosavetoggle?.(enabled);
		},
		setAutosaveFlag(enabled: boolean): void {
			autosaveEnabled = enabled;
		},
		get autosaveActive() {
			return autosaveActive;
		},
		get versionHistoryOpen() {
			return versionHistoryOpen;
		},
		set versionHistoryOpen(next: boolean) {
			versionHistoryOpen = next;
		},
		get signatureWarningOpen() {
			return signatureWarningOpen;
		},
		closeSignatureWarning,
	};
}
