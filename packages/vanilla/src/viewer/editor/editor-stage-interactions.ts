import { isAdditiveSelectionPress } from 'pptx-viewer-shared';

import { findActiveElement } from './editor-active-elements';
import {
	canBeginMoveGesture,
	isElementIdSelectable,
	selectionInteractivity,
} from './editor-lock-gates';
import { createMarqueeController } from './editor-marquee';
import { handleSpecialPointerAction } from './editor-pointer-special-actions';
import type { StageInteractions, StageInteractionsDeps } from './editor-stage-interaction-types';
import { resolveStagePoint } from './editor-stage-point';
import { createTransformGestures } from './editor-transform-gestures';
import { createElementDoubleTapRecognizer } from './element-double-tap';
import { resolveTopLevelElementId } from './element-hit';
import type { InlineEditorSession } from './inline-text-editor';
import { canInlineEditElement, openInlineEditor } from './inline-text-editor';
import { createShapeAdjustGesture } from './shape-adjust-gesture';
import { handleStructuredDblClick } from './structured-dblclick';
import type { TableCellEditorSession } from './table-cell-editor';
import { bindTableTouchEditor } from './table-touch-editor';

export function createStageInteractions(deps: StageInteractionsDeps): StageInteractions {
	const { doc, store, ops } = deps;
	let inline: InlineEditorSession | null = null;
	let tableInline: TableCellEditorSession | null = null;
	const disposeTableTouch = bindTableTouchEditor({
		doc,
		getState: store.get,
		getStage: deps.getStageRoot,
		getOverlay: () => deps.getOverlay()?.root ?? null,
		ops,
		onOpen: (session) => (tableInline = session),
		onEditEquation: deps.onEditEquation,
	});
	const gestures = createTransformGestures({
		store,
		ops,
		getScale: deps.getScale,
		getOverlay: deps.getOverlay,
	});

	const adjustGesture = createShapeAdjustGesture({ store, ops, getScale: deps.getScale });

	const stagePoint = (event: PointerEvent) =>
		resolveStagePoint(deps.getOverlay()?.root, deps.getScale(), event);
	const marquee = createMarqueeController({
		doc,
		store,
		ops,
		getScale: deps.getScale,
		getOverlayRoot: () => deps.getOverlay()?.root ?? null,
		stagePoint,
	});

	// Touch/pen double-tap → inline/structured editing (native dblclick is
	// unreliable on touch; table cells are already handled at document capture
	// by bindTableTouchEditor, which stops propagation before this sees them).
	const isElementDoubleTap = createElementDoubleTapRecognizer();

	const closeInline = (commit: boolean): void => {
		tableInline?.close(commit);
		tableInline = null;
		const session = inline;
		inline = null;
		if (commit) {
			session?.commit();
		} else {
			session?.cancel();
		}
	};

	const enterInlineEdit = (id: string): void => {
		const state = store.get();
		const el = findActiveElement(state, id);
		const overlay = deps.getOverlay();
		if (!el || !canInlineEditElement(el) || !overlay || inline) {
			return;
		}
		ops.select(id);
		overlay.setEditing(true);
		inline = openInlineEditor({
			doc,
			overlayRoot: overlay.root,
			box: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 },
			scale: deps.getScale(),
			element: el,
			spellCheck: state.spellCheckEnabled,
			onInput: (text) => deps.onInlineTextInput?.(id, text),
			onCommit: (text) => {
				// Flush the queued live-preview frame first so it cannot land after
				// the committed text and revert it.
				deps.flushInlineTextInput?.();
				ops.commitInlineText(id, text);
			},
			onSelectionChange: (selection) => store.set({ selectedTextRange: selection }),
			onClose() {
				inline = null;
				deps.getOverlay()?.setEditing(false);
			},
		});
	};

	/** Shared dblclick / touch-double-tap activation: structured editors first, then inline text. */
	const activateDoubleClick = (event: MouseEvent, id: string | null): void => {
		const state = store.get();
		const structured = handleStructuredDblClick({
			event,
			state,
			doc,
			ops,
			stage: deps.getStageRoot(),
			overlay: deps.getOverlay()?.root ?? null,
			onEditEquation: deps.onEditEquation,
		});
		if (structured.handled) {
			tableInline = structured.tableSession;
			return;
		}
		if (id && isElementIdSelectable(state, id)) {
			enterInlineEdit(id);
		}
	};

	return {
		onStagePointerDown(event) {
			const state = store.get();
			if (!state.editable || state.presenting || event.button !== 0) {
				return;
			}
			// Resolve the hit BEFORE committing a pending inline edit: the commit
			// re-renders the stage synchronously, which detaches event.target.
			const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
			if (inline || tableInline) {
				// A press outside the editing surface (the surface stops its own
				// pointerdown) commits the pending edit so typed text is never
				// dropped, then continues as a normal select/marquee press. This is
				// the only close path guaranteed to run for touch input, where the
				// tap-away may not move focus and therefore never fires blur.
				closeInline(true);
			}
			if (
				handleSpecialPointerAction({
					event,
					elementId: id,
					state,
					store,
					ops,
					onEyedropper: deps.onEyedropper,
				})
			) {
				return;
			}
			if (state.formatPainterSourceId) {
				// A locked shape does not take a format-painter drop either.
				if (id && isElementIdSelectable(state, id)) {
					ops.applyFormatPainter(state.formatPainterSourceId, id);
				}
				store.set({ formatPainterSourceId: null });
				return;
			}
			// `noSelect` (a:spLocks) makes the press behave as if it landed on empty
			// canvas: an unselectable shape is not a hit, so it starts a marquee.
			const interactive = id !== null && isElementIdSelectable(state, id);
			if (
				isElementDoubleTap(
					event.pointerType,
					interactive ? id : null,
					event.timeStamp || Date.now(),
				)
			) {
				// Suppress the compatibility mouse events this tap would synthesize:
				// their default mousedown would steal focus from the inline surface
				// opened below and immediately blur-close it.
				event.preventDefault();
				activateDoubleClick(event, id);
				return;
			}
			if (!interactive) {
				marquee.begin(event);
				return;
			}
			if (isAdditiveSelectionPress(event)) {
				const ids = state.selectedElementIds.includes(id)
					? state.selectedElementIds.filter((selectedId) => selectedId !== id)
					: [...state.selectedElementIds, id];
				ops.select(ids.at(-1) ?? null, ids);
				return;
			}
			if (state.selectedElementId !== id || state.selectedElementIds.length !== 1) {
				ops.select(id, [id]);
			}
			// A `noMove` shape stays SELECTABLE (so it can be unlocked from the
			// inspector) but must never arm the drag.
			if (canBeginMoveGesture(store.get(), id)) {
				gestures.begin('move', id, event);
			}
		},
		onStagePointerMove(event) {
			if (!deps.onCursorMove) {
				return;
			}
			const rect = deps.getOverlay()?.root.getBoundingClientRect();
			const scale = deps.getScale();
			if (!rect || !(scale > 0)) {
				return;
			}
			deps.onCursorMove((event.clientX - rect.left) / scale, (event.clientY - rect.top) / scale);
		},
		onStageDblClick(event) {
			const state = store.get();
			if (!state.editable || state.presenting || inline || tableInline) {
				return;
			}
			const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
			activateDoubleClick(event, id);
		},
		beginHandleGesture(kind, event, handle) {
			const state = store.get();
			const id = state.selectedElementId;
			const allowed = selectionInteractivity(state);
			if (!id || (kind === 'resize' ? !allowed.resizable : !allowed.rotatable)) {
				return;
			}
			gestures.begin(kind, id, event, handle);
		},
		beginAdjustGesture: (event) => adjustGesture.begin(event),
		closeInline,
		inlineActive: () => inline !== null || tableInline !== null,
		dispose() {
			closeInline(false);
			disposeTableTouch();
			gestures.dispose();
			adjustGesture.dispose();
			marquee.dispose();
		},
	};
}
