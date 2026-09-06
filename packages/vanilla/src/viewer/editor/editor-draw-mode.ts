import { buildLiveInkStrokeView } from 'pptx-viewer-shared';

import type { DrawTool, Store, ViewerState } from '../state';
import { createDrawGestures } from './editor-draw-gestures';
import type { EditActions } from './editor-edit-ops';
import { createInkLivePreviewOverlay } from './ink-live-preview-overlay';

/**
 * The Draw ribbon tab's mode-switching + pointer-routing glue, extracted from
 * `editor-controller.ts` to keep that file within the file-size budget
 * (mirrors why `editor-stage-interactions.ts` was pulled out too). Owns:
 *
 * - the `DrawGestures` pointer-event lifecycle (see `editor-draw-gestures.ts`)
 * - routing a stage `pointerdown` / `dblclick` to drawing or to the normal
 *   move/resize/rotate/inline-edit `interactions`, whichever the active
 *   `DrawTool` implies, so the two never run at once
 * - the `setTool` / `setColor` / `setWidth` store setters the ribbon's Draw
 *   tab handlers call, plus clearing selection/inline-edit when a drawing
 *   tool becomes active
 */

/** The subset of `StageInteractions` this module falls back to and resets. */
export interface DrawModeStageInteractions {
	onStagePointerDown(event: PointerEvent): void;
	onStageDblClick(event: MouseEvent): void;
	closeInline(commit: boolean): void;
}

export interface DrawModeDeps {
	doc: Document;
	store: Store<ViewerState>;
	editActions: Pick<EditActions, 'commitStroke' | 'eraseInkElement'>;
	interactions: DrawModeStageInteractions;
	getScale(): number;
	/** Stage overlay origin in client coordinates, for pointer->stage mapping. */
	getStageOrigin(): { left: number; top: number };
	getStageRoot(): Element | null;
}

export interface DrawModeController {
	/** Routes to the drawing gesture controller or the normal `interactions`. */
	onStagePointerDown(event: PointerEvent): void;
	/** Suppresses inline-edit while drawing; otherwise routes to `interactions`. */
	onStageDblClick(event: MouseEvent): void;
	/** Reflect the active tool on `data-draw-tool` so CSS can swap the stage cursor. */
	syncCursor(stageWrap: HTMLElement | null): void;
	setTool(tool: DrawTool): void;
	setColor(color: string): void;
	setWidth(width: number): void;
	/** Abort an in-progress stroke without committing (teardown). */
	dispose(): void;
}

export function createDrawModeController(deps: DrawModeDeps): DrawModeController {
	const { store, editActions, interactions } = deps;

	// The live in-progress stroke preview: mounted inside the scaled
	// `.pptxv-stage` (like `motion-path-overlay.ts`) and redrawn straight from
	// the gesture callbacks below, independent of the store-driven render
	// cycle, so it tracks every pointermove at full rate.
	const inkPreview = createInkLivePreviewOverlay(deps.doc);
	const resolveInkTool = (tool: DrawTool): 'pen' | 'highlighter' | 'freeform' =>
		tool === 'highlighter' ? 'highlighter' : tool === 'freeform' ? 'freeform' : 'pen';

	const drawGestures = createDrawGestures({
		getScale: deps.getScale,
		getStageOrigin: deps.getStageOrigin,
		getStageRoot: deps.getStageRoot,
		getTool: () => store.get().drawTool,
		getColor: () => store.get().drawColor,
		getWidth: () => store.get().drawWidth,
		onCommitStroke: (stroke) => editActions.commitStroke(stroke),
		onEraseAt: (id) => editActions.eraseInkElement(id),
		onStrokePreview: (points) => {
			if (!points) {
				inkPreview.update(null, store.get().canvasSize);
				return;
			}
			inkPreview.mount(deps.getStageRoot() as HTMLElement | null);
			const view = buildLiveInkStrokeView({
				points: [...points],
				color: store.get().drawColor,
				width: store.get().drawWidth,
				tool: resolveInkTool(store.get().drawTool),
			});
			inkPreview.update(view, store.get().canvasSize);
		},
	});

	/** True while a drawing tool (not `'select'`) should own stage pointer input. */
	const drawingActive = (state: ViewerState): boolean =>
		state.editable && !state.presenting && state.drawTool !== 'select';

	return {
		onStagePointerDown(event) {
			if (drawingActive(store.get())) {
				drawGestures.onStagePointerDown(event);
				return;
			}
			interactions.onStagePointerDown(event);
		},
		onStageDblClick(event) {
			if (drawingActive(store.get())) {
				// Drawing owns the stage; suppress inline-edit while a tool is active.
				return;
			}
			interactions.onStageDblClick(event);
		},
		syncCursor(stageWrap) {
			if (!stageWrap) {
				return;
			}
			const state = store.get();
			stageWrap.dataset.drawTool = drawingActive(state) ? state.drawTool : 'select';
		},
		setTool(tool) {
			const state = store.get();
			if (state.drawTool === tool) {
				return;
			}
			if (tool !== 'select') {
				interactions.closeInline(true);
			}
			store.set({
				drawTool: tool,
				selectedElementId: tool === 'select' ? state.selectedElementId : null,
			});
		},
		setColor: (color) => store.set({ drawColor: color }),
		setWidth: (width) => store.set({ drawWidth: Math.max(1, Math.round(width)) }),
		dispose: () => {
			drawGestures.dispose();
			inkPreview.destroy();
		},
	};
}
