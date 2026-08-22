import type { InteractionBox, SelectionTransformBox } from 'pptx-viewer-shared';
import {
	computeGridSpacingPx,
	moveSelection,
	resizeSelection,
	selectionBounds,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { findActiveElement, getActiveElements } from './editor-active-elements';
import { syncConnectorsForMovedElements } from './editor-connector-sync';
import type { GestureController, GestureKind } from './editor-gestures';
import { createGestureController } from './editor-gestures';
import { interactableIds } from './editor-lock-gates';
import type { EditorOps } from './editor-operations';
import { snapSiblings, snapToGrid } from './editor-pointer-special-actions';
import type { SelectionOverlay } from './selection-overlay';

/**
 * The move / resize / rotate gesture wiring for the stage: it owns the
 * selection snapshot a gesture is measured against, applies the shared
 * multi-selection transforms as live preview frames, and closes the gesture by
 * rerouting attached connectors and committing.
 *
 * Split out of `editor-stage-interactions.ts` (which routes pointer events)
 * because all of its state is private to the gesture lifecycle.
 */

/** The lock each gesture kind is gated on. */
const GESTURE_INTERACTION = {
	move: 'move',
	resize: 'resize',
	rotate: 'rotate',
} as const satisfies Record<GestureKind, 'move' | 'resize' | 'rotate'>;

export interface TransformGesturesDeps {
	store: Store<ViewerState>;
	ops: EditorOps;
	getScale(): number;
	getOverlay(): SelectionOverlay | null;
}

export function createTransformGestures(deps: TransformGesturesDeps): GestureController {
	const { store, ops } = deps;
	let gestureBoxes: SelectionTransformBox[] = [];
	let gestureBounds: InteractionBox | null = null;
	let gestureKind: GestureKind = 'move';
	/**
	 * The ids the running gesture is allowed to mutate. A multi-selection drag
	 * moves only its movable members (PowerPoint leaves a pinned shape behind),
	 * so the bounds still come from the whole selection while the writes do not.
	 */
	let gestureAllowedIds = new Set<string>();

	const elementBox = (id: string): InteractionBox | undefined => {
		const state = store.get();
		const selected = getActiveElements(state).filter((el) =>
			state.selectedElementIds.includes(el.id),
		);
		if (selected.length > 1 && state.selectedElementIds.includes(id)) {
			return selectionBounds(selected) ?? undefined;
		}
		const el = findActiveElement(state, id);
		return el
			? { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 }
			: undefined;
	};

	return createGestureController({
		getScale: deps.getScale,
		getElementBox: elementBox,
		getSiblings: () => snapSiblings(store.get()),
		getStageOrigin() {
			const rect = deps.getOverlay()?.root.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		onStart(id, kind) {
			const state = store.get();
			gestureKind = kind;
			gestureBoxes = getActiveElements(state)
				.filter((el) => state.selectedElementIds.includes(el.id))
				.map(({ id: boxId, x, y, width, height, rotation }) => ({
					id: boxId,
					x,
					y,
					width,
					height,
					rotation,
				}));
			gestureBounds = selectionBounds(gestureBoxes);
			gestureAllowedIds = new Set(
				interactableIds(
					state,
					gestureBoxes.length > 0 ? gestureBoxes.map((box) => box.id) : [id],
					GESTURE_INTERACTION[kind],
				),
			);
			ops.pushHistory();
			store.set({ interactionActive: true });
		},
		onPreview(transform, lines) {
			const state = store.get();
			transform = snapToGrid(
				transform,
				state.snapToGrid,
				computeGridSpacingPx(state.viewProperties?.gridSpacing, 10),
			);
			if (gestureBoxes.length > 1 && gestureBounds && gestureKind !== 'rotate') {
				const next =
					gestureKind === 'move'
						? moveSelection(
								gestureBoxes,
								transform.x - gestureBounds.x,
								transform.y - gestureBounds.y,
							)
						: resizeSelection(gestureBoxes, gestureBounds, transform);
				for (const box of next) {
					// A pinned member of the selection stays put while the rest travel.
					if (!gestureAllowedIds.has(box.id)) {
						continue;
					}
					ops.patchGeometry(box.id, { ...box, rotation: box.rotation ?? 0 });
				}
			} else if (gestureAllowedIds.has(transform.id)) {
				ops.patchGeometry(transform.id, transform);
			}
			deps.getOverlay()?.setSnapLines(lines, deps.getScale());
		},
		onEnd(transform, moved, id) {
			deps.getOverlay()?.setSnapLines([], 1);
			if (transform && gestureBoxes.length <= 1 && gestureAllowedIds.has(id)) {
				// `transform` here is the gesture controller's raw last-preview box,
				// computed BEFORE `onPreview` above snapped it: reassigning `onPreview`'s
				// own `transform` parameter never fed back into the gesture's internal
				// `last` value. Re-applying the snap here is what makes the grid-snapped
				// position the user saw during the drag actually stick on release,
				// instead of silently reverting to the unsnapped position.
				const state = store.get();
				const snapped = snapToGrid(
					transform,
					state.snapToGrid,
					computeGridSpacingPx(state.viewProperties?.gridSpacing, 10),
				);
				ops.patchGeometry(id, snapped);
			}
			store.set({ interactionActive: false });
			if (moved) {
				// A moved/resized shape drags its attached connectors with it. Runs
				// BEFORE the commit so the reroute lands in the same undo step (the
				// gesture's own `pushHistory`), never as a second one.
				syncConnectorsForMovedElements(store, new Set([...gestureAllowedIds, id]));
				ops.commitChange();
			}
		},
	});
}
