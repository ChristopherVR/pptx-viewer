import type { PptxElement } from 'pptx-viewer-core';
import type {
	EditPointsElementPatch,
	FreeformToolKind,
	ResolvedCustomization,
} from 'pptx-viewer-shared';
import { canEditElementPoints, isEditPointsEnabled } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { EditPointsOverlay } from './edit-points-overlay';
import { createEditPointsOverlay } from './edit-points-overlay';
import { findActiveElement } from './editor-active-elements';
import type { FreeformToolOverlay } from './freeform-tool-overlay';
import { createFreeformToolOverlay } from './freeform-tool-overlay';

export interface OutlineAuthoringDeps {
	doc: Document;
	store: Store<ViewerState>;
	getTranslator(): Translator;
	getScale(): number;
	/** The stage host; the scaled `.pptxv-stage` is resolved from it per sync. */
	getStageWrap(): HTMLElement | null;
	/** The host's resolved UI customisation (omitted: none). */
	getCustomization?(): ResolvedCustomization | undefined;
	/** The editor's element-update path (one undo step per call). */
	applyElementPatch(id: string, patch: EditPointsElementPatch): void;
	/** The editor's insert path (selects the new element, one undo step). */
	insertElement(element: PptxElement): void;
}

export interface OutlineAuthoringController {
	/** Start Edit Points on `id`; false when the shape cannot be edited. */
	startEditPoints(id: string): boolean;
	/** Arm (or, with null, disarm) a Freeform: Shape / Curve tool. */
	armFreeformTool(tool: FreeformToolKind | null): void;
	/** True while `id`'s points are being edited (its resize chrome hides). */
	isEditingPoints(id: string | null): boolean;
	/** Mount / follow / tear down the overlays for the current store state. */
	sync(): void;
	detach(): void;
}

/**
 * Owns the two outline-authoring overlays: Edit Points on one shape and the
 * armed Freeform: Shape / Curve tool. Both live inside the stage's zoom
 * transform (like the motion-path layer), so they are re-mounted on every
 * sync, since this binding rebuilds `.pptxv-stage` on each render.
 *
 * The active mode is store state (`editPointsElementId`, `freeformTool`), so
 * the ribbon and the context menu drive it without a reference to this
 * controller, and at most one mode is ever active.
 */
export function createOutlineAuthoringController(
	deps: OutlineAuthoringDeps,
): OutlineAuthoringController {
	const { doc, store } = deps;
	let editPoints: EditPointsOverlay | null = null;
	let freeform: FreeformToolOverlay | null = null;

	const stage = (): HTMLElement | null =>
		deps.getStageWrap()?.querySelector<HTMLElement>('.pptxv-stage') ?? null;
	const enabled = (): boolean => {
		const customization = deps.getCustomization?.();
		return customization ? isEditPointsEnabled(customization) : true;
	};

	const dropEditPoints = (): void => {
		const current = editPoints;
		editPoints = null;
		current?.destroy();
	};
	const dropFreeform = (): void => {
		const current = freeform;
		freeform = null;
		current?.destroy();
	};

	const syncFreeform = (state: ViewerState, tool: FreeformToolKind): void => {
		dropEditPoints();
		if (freeform && freeform.tool !== tool) {
			dropFreeform();
		}
		freeform ??= createFreeformToolOverlay({
			doc,
			t: deps.getTranslator(),
			tool,
			canvasSize: state.canvasSize,
			scale: deps.getScale(),
			onCommit: (element) => {
				store.set({ freeformTool: null });
				deps.insertElement(element);
			},
			onCancel: () => store.set({ freeformTool: null }),
		});
		freeform.update(state.canvasSize, deps.getScale());
		freeform.mount(stage());
	};

	const syncEditPoints = (state: ViewerState, id: string): void => {
		dropFreeform();
		const element = findActiveElement(state, id);
		if (!element || !canEditElementPoints(element) || !enabled()) {
			dropEditPoints();
			store.set({ editPointsElementId: null });
			return;
		}
		if (editPoints && editPoints.elementId !== id) {
			dropEditPoints();
		}
		editPoints ??= createEditPointsOverlay({
			doc,
			t: deps.getTranslator(),
			element,
			canvasSize: state.canvasSize,
			scale: deps.getScale(),
			hiddenCommands: deps.getCustomization?.()?.hiddenEditPointsCommands,
			onCommit: (elementId, patch) => deps.applyElementPatch(elementId, patch),
			onExit: () => {
				dropEditPoints();
				store.set({ editPointsElementId: null });
			},
		});
		editPoints.update(element, state.canvasSize, deps.getScale());
		editPoints.mount(stage());
	};

	return {
		startEditPoints(id) {
			const state = store.get();
			if (!state.editable || !enabled() || !canEditElementPoints(findActiveElement(state, id))) {
				return false;
			}
			store.set({ editPointsElementId: id, freeformTool: null });
			return true;
		},
		armFreeformTool(tool) {
			store.set({
				freeformTool: tool,
				...(tool ? { editPointsElementId: null } : {}),
			});
		},
		isEditingPoints(id) {
			return id !== null && store.get().editPointsElementId === id;
		},
		sync() {
			const state = store.get();
			const editing = state.editable && !state.presenting;
			if (editing && state.freeformTool) {
				syncFreeform(state, state.freeformTool);
			} else if (editing && state.editPointsElementId) {
				syncEditPoints(state, state.editPointsElementId);
			} else {
				dropFreeform();
				dropEditPoints();
			}
		},
		detach() {
			dropFreeform();
			dropEditPoints();
		},
	};
}
