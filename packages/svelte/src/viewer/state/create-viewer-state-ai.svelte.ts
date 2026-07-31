import type { PptxAiBridge } from 'pptx-viewer-shared/ai';

import { createSvelteAiBridge } from '../ai';
import { AiPanelController } from '../ai/ai-panel-controller.svelte';
import type { AiCanvasHighlight } from '../ai/ai-panel-controller.svelte';
import type { CollaborationController } from '../collab';
import type { EditorState } from '../editor/editor-state.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { PresentationLoader } from './presentation-loader.svelte';
import type { ViewerState } from './viewer-state.svelte';

export interface AiClusterDeps {
	loader: PresentationLoader;
	viewer: ViewerState;
	editor: EditorState;
	collab: CollaborationController;
	options: CreateViewerStateOptions;
	/** Flip the viewer's `editable` flag: an AI write implies editing. */
	setEditable(editable: boolean): void;
}

export interface AiCluster {
	/** The SDK-free bridge handed to the (lazily imported) chat panel. */
	readonly bridge: PptxAiBridge;
	/** On-canvas scope: focus targets, pick mode, live tool-focus highlights. */
	readonly panel: AiPanelController;
	/** Whether the right-side chat panel is open (ribbon Sparkles toggle). */
	panelOpen: boolean;
	/** Element rings to draw on the active slide; empty when AI is disabled. */
	readonly canvasHighlights: readonly AiCanvasHighlight[];
}

/**
 * AI assistant wiring: the editor/deck bridge, the on-canvas focus controller,
 * and the panel's open flag. Split out of `createViewerState` to keep that file
 * under the repo's file-size budget.
 *
 * The bridge is built eagerly (it has no `ai`-SDK dependency, by design), but
 * the panel component and the `@ai-sdk/svelte` + `ai` peers it pulls are only
 * imported when the panel first opens. Every AI write funnels through
 * `editor.commitSlides` so one proposal is ONE undoable history entry, exactly
 * like a manual edit.
 *
 * Named `use*`, not `build*`: it registers a teardown `$effect` for the panel
 * controller, so it must be called during component initialization.
 */
export function useAiCluster(deps: AiClusterDeps): AiCluster {
	const { loader, viewer, editor, collab, options } = deps;

	let panelOpen = $state(false);

	const bridge = createSvelteAiBridge({
		getSlides: () => editor.slides,
		getActiveSlideIndex: () => viewer.current,
		getCanvasSize: () => loader.canvasSize,
		getTheme: () => loader.presentationTheme,
		getHandler: () => loader.handler,
		getFileName: () => options.getFileName?.(),
		goToSlide: (index) => viewer.goTo(index),
		selectElements: (slideIndex, ids) => {
			if (slideIndex !== viewer.current) {
				viewer.goTo(slideIndex);
			}
			editor.selection.setAll(ids);
		},
		commitSlides: (next) => {
			if (collab.readOnly) {
				return;
			}
			// Ensure the history-tracked commit is not silently dropped by the
			// editor's editable gate (an AI edit implies editing).
			deps.setEditable(true);
			editor.editable = true;
			editor.commitSlides(next);
		},
		applyTheme: (updates) => {
			const nextTheme = { ...(loader.presentationTheme ?? {}), ...updates };
			loader.presentationTheme = nextTheme;
			if (nextTheme.colorScheme) {
				loader.colorScheme = nextTheme.colorScheme;
			}
		},
		// Presentation-level (deck) state for the AI getDeckData / applyDeckData
		// seam. Reads come off the editor + loader; writes route through the same
		// undoable editor mutations the inspector Properties tab uses.
		getSections: () => editor.sections,
		getPresentationProperties: () => editor.presentationProperties,
		getCoreProperties: () => editor.coreProperties,
		getAppProperties: () => editor.appProperties,
		getCustomProperties: () => editor.customProperties,
		setCanvasSize: (size) => {
			deps.setEditable(true);
			editor.editable = true;
			const width = Math.max(1, Math.round(size.width));
			const height = Math.max(1, Math.round(size.height));
			if (!Number.isFinite(width) || !Number.isFinite(height)) {
				return;
			}
			loader.canvasSize = { width, height };
			editor.commitChange();
		},
		setSections: (sections) => {
			deps.setEditable(true);
			editor.editable = true;
			editor.pushHistory();
			editor.sections = sections;
			editor.commitChange();
		},
		setPresentationProperties: (props) => {
			deps.setEditable(true);
			editor.editable = true;
			editor.presentationMetadata.updatePresentationProperties(props);
		},
		setDocumentProperties: (core, app, custom) => {
			deps.setEditable(true);
			editor.editable = true;
			editor.updateDocumentProperties(core, app, custom);
		},
	});

	const panel = new AiPanelController({
		getActiveSlideIndex: () => viewer.current,
		getSelectedElementId: () => editor.selectedElementId,
		getSelectedElementIds: () => editor.selection.ids,
		getSelectedElement: () => editor.selectedElement,
		openPanel: () => {
			panelOpen = true;
		},
	});
	$effect(() => () => panel.dispose());

	return {
		bridge,
		panel,
		get panelOpen() {
			return panelOpen;
		},
		set panelOpen(next: boolean) {
			panelOpen = next;
		},
		// Highlights only on the active slide; empty when the assistant is off.
		get canvasHighlights() {
			return options.getAiEnabled?.() ? panel.canvasHighlights : [];
		},
	};
}
