import type { PptxSlide } from 'pptx-viewer-core';
import type { AutosaveDisabledReason } from 'pptx-viewer-shared';
import { resolveAutosaveActivation, resolveAutosaveIntervalMs } from 'pptx-viewer-shared';

import { CollaborationController, CollaborationDialogsState } from '../collab';
import { useCollaborationPresenceEffects } from '../collab/collaboration-presence-effects.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { AutosaveRecoveryController } from './autosave-recovery.svelte';
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
	/**
	 * File > Options > Save > "Save AutoRecover information every N minutes",
	 * in seconds. Used whenever the host passed no explicit `autosaveIntervalMs`.
	 * A closure, not a value: the options cluster is built after this one.
	 */
	getOptionsIntervalSeconds?: () => number | undefined;
}

export interface CollabCluster {
	collab: CollaborationController;
	dialogs: CollaborationDialogsState;
	autosaveCtl: AutosaveController;
	autosaveRecovery: AutosaveRecoveryController;
	/**
	 * The EFFECTIVE toggle state for the title bar: the user's preference,
	 * forced to false while the host vetoes autosave so the switch renders off
	 * rather than claiming to be on while nothing is written.
	 */
	readonly autosaveEnabled: boolean;
	/**
	 * The user's RAW preference, unaffected by the host veto. The File > Options
	 * store mirrors this one: a host that happens to ship `autosave={false}`
	 * must not overwrite the AutoSave choice the user made for every other host.
	 */
	readonly autosavePreference: boolean;
	/** False only when the host passed `autosave={false}`. */
	readonly autosaveToggleAvailable: boolean;
	readonly autosaveDisabledReason: AutosaveDisabledReason | undefined;
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

	// The user's AutoSave preference, DEFAULT ON. The host `autosave` prop is a
	// ceiling applied below, not the seed for this flag: seeding from the prop is
	// what left this binding writing no recovery snapshot at all for any host
	// that never opted in. File > Options' own AutoSave switch mirrors this
	// value through `useViewerOptionsWiring`.
	let autosavePreference = $state(true);
	const autosaveActivation = $derived(
		resolveAutosaveActivation({
			hostAutosave: options.getAutosave(),
			userEnabled: autosavePreference,
			// A read-only collaborator has nothing to write back, so the session's
			// read-only veto folds into "can this user edit at all".
			canEdit: deps.getEditable() && !collab.readOnly,
			filePath: options.getFilePath(),
		}),
	);
	const autosaveActive = $derived(autosaveActivation.active);
	const autosaveCtl = new AutosaveController({
		getEnabled: () => autosaveActive,
		getIntervalMs: () =>
			resolveAutosaveIntervalMs({
				hostIntervalMs: options.autosaveIntervalMs,
				optionsIntervalSeconds: deps.getOptionsIntervalSeconds?.(),
			}),
		getFilePath: options.getFilePath,
		getSlides: () => editor.renderedSlides,
		getSlideMasters: () => editor.slideMasters,
		getNotesMaster: () => editor.notesMaster,
		getHandoutMaster: () => editor.handoutMaster,
		getSections: () => editor.sections,
		getHandler: () => loader.handler,
		// Threaded through only so the snapshot uses the shared save decision;
		// a recovery snapshot stays plaintext whatever the protection state is.
		getSaveIntent: () => editor.saveIntent(),
		getLoadCount: () => loader.loadCount,
		// The loader bumps `loadCount` a flush before the editor adopts its
		// slides; this changes WITH them, so the adoption cannot be mistaken for
		// an edit. See `EditorState.seedNonce`.
		getSeedNonce: () => editor.seedNonce,
		onSaved: (bytes) => options.onautosave?.(bytes),
	});

	// "Is there a snapshot from a crashed session?", asked once per loaded deck.
	// Gated on the HOST prop only: a user who merely switched AutoSave off is
	// still entitled to the work the previous session had already written.
	const autosaveRecovery = new AutosaveRecoveryController({
		getFilePath: options.getFilePath,
		getAutosaveAllowed: () => options.getAutosave() !== false,
		getLoading: () => loader.loading,
		getError: () => loader.error,
		getSlideCount: () => loader.slides.length,
		getLoadCount: () => loader.loadCount,
		load: (bytes) => loader.load(bytes),
	});

	return {
		collab,
		dialogs,
		autosaveCtl,
		autosaveRecovery,
		get autosaveEnabled() {
			return autosaveActivation.toggleAvailable && autosavePreference;
		},
		get autosavePreference() {
			return autosavePreference;
		},
		get autosaveToggleAvailable() {
			return autosaveActivation.toggleAvailable;
		},
		get autosaveDisabledReason() {
			return autosaveActivation.reason;
		},
		setAutosaveEnabled(enabled: boolean): void {
			// Inert while the host forbids autosave: a switch that silently does
			// nothing is worse than a switch that refuses to move.
			if (!autosaveActivation.toggleAvailable) {
				return;
			}
			autosavePreference = enabled;
			options.onautosavetoggle?.(enabled);
		},
		setAutosaveFlag(enabled: boolean): void {
			autosavePreference = enabled;
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
