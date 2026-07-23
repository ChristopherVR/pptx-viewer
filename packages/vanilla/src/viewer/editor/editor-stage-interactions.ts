import type { InteractionBox, SelectionTransformBox } from 'pptx-viewer-shared';
import {
	computeMarqueeHitIds,
	isElementIdInteractive,
	mergeAdditiveSelection,
	moveSelection,
	resizeSelection,
	selectionBounds,
} from 'pptx-viewer-shared';

import { findActiveElement, getActiveElements } from './editor-active-elements';
import { createGestureController } from './editor-gestures';
import {
	handleSpecialPointerAction,
	snapSiblings,
	snapToGrid,
} from './editor-pointer-special-actions';
import type { StageInteractions, StageInteractionsDeps } from './editor-stage-interaction-types';
import { resolveStagePoint } from './editor-stage-point';
import { createElementDoubleTapRecognizer } from './element-double-tap';
import { resolveTopLevelElementId } from './element-hit';
import type { InlineEditorSession } from './inline-text-editor';
import { canInlineEditElement, openInlineEditor } from './inline-text-editor';
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
	let gestureBoxes: SelectionTransformBox[] = [];
	let gestureBounds: InteractionBox | null = null;
	let gestureKind: 'move' | 'resize' | 'rotate' = 'move';
	let marquee: {
		pointerId: number;
		startX: number;
		startY: number;
		additive: boolean;
		el: HTMLElement;
	} | null = null;

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

	const gestures = createGestureController({
		getScale: deps.getScale,
		getElementBox: elementBox,
		getSiblings: () => snapSiblings(store.get()),
		getStageOrigin() {
			const rect = deps.getOverlay()?.root.getBoundingClientRect();
			return { left: rect?.left ?? 0, top: rect?.top ?? 0 };
		},
		onStart(_id, kind) {
			const state = store.get();
			gestureKind = kind;
			gestureBoxes = getActiveElements(state)
				.filter((el) => state.selectedElementIds.includes(el.id))
				.map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation }));
			gestureBounds = selectionBounds(gestureBoxes);
			ops.pushHistory();
			store.set({ interactionActive: true });
		},
		onPreview(transform, lines) {
			transform = snapToGrid(transform, store.get().snapToGrid);
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
					ops.patchGeometry(box.id, { ...box, rotation: box.rotation ?? 0 });
				}
			} else {
				ops.patchGeometry(transform.id, transform);
			}
			deps.getOverlay()?.setSnapLines(lines, deps.getScale());
		},
		onEnd(transform, moved, id) {
			deps.getOverlay()?.setSnapLines([], 1);
			if (transform && gestureBoxes.length <= 1) {
				ops.patchGeometry(id, transform);
			}
			store.set({ interactionActive: false });
			if (moved) {
				ops.commitChange();
			}
		},
	});

	const stagePoint = (event: PointerEvent) =>
		resolveStagePoint(deps.getOverlay()?.root, deps.getScale(), event);
	const finishMarquee = (event: PointerEvent): void => {
		if (!marquee || event.pointerId !== marquee.pointerId) {
			return;
		}
		const point = stagePoint(event);
		const state = store.get();
		const hits = point
			? computeMarqueeHitIds(
					{ startX: marquee.startX, startY: marquee.startY, currentX: point.x, currentY: point.y },
					getActiveElements(state),
				)
			: [];
		const ids = marquee.additive ? mergeAdditiveSelection(state.selectedElementIds, hits) : hits;
		marquee.el.remove();
		marquee = null;
		window.removeEventListener('pointermove', updateMarquee);
		window.removeEventListener('pointerup', finishMarquee);
		window.removeEventListener('pointercancel', finishMarquee);
		ops.select(ids.at(-1) ?? null, ids);
	};
	const updateMarquee = (event: PointerEvent): void => {
		if (!marquee || event.pointerId !== marquee.pointerId) {
			return;
		}
		const point = stagePoint(event);
		if (!point) {
			return;
		}
		marquee.el.style.left = `${Math.min(marquee.startX, point.x) * deps.getScale()}px`;
		marquee.el.style.top = `${Math.min(marquee.startY, point.y) * deps.getScale()}px`;
		marquee.el.style.width = `${Math.abs(point.x - marquee.startX) * deps.getScale()}px`;
		marquee.el.style.height = `${Math.abs(point.y - marquee.startY) * deps.getScale()}px`;
	};

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
		if (id && isElementIdInteractive(id, state.editTemplateMode)) {
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
				if (id && isElementIdInteractive(id, state.editTemplateMode)) {
					ops.applyFormatPainter(state.formatPainterSourceId, id);
				}
				store.set({ formatPainterSourceId: null });
				return;
			}
			const interactive = id !== null && isElementIdInteractive(id, state.editTemplateMode);
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
				const point = stagePoint(event);
				const overlay = deps.getOverlay();
				if (!point || !overlay) {
					return;
				}
				const el = doc.createElement('div');
				el.className = 'pptxv-marquee';
				overlay.root.appendChild(el);
				marquee = {
					pointerId: event.pointerId,
					startX: point.x,
					startY: point.y,
					additive: event.shiftKey,
					el,
				};
				window.addEventListener('pointermove', updateMarquee);
				window.addEventListener('pointerup', finishMarquee);
				window.addEventListener('pointercancel', finishMarquee);
				return;
			}
			if (event.shiftKey) {
				const ids = state.selectedElementIds.includes(id)
					? state.selectedElementIds.filter((selectedId) => selectedId !== id)
					: [...state.selectedElementIds, id];
				ops.select(ids.at(-1) ?? null, ids);
				return;
			}
			if (state.selectedElementId !== id || state.selectedElementIds.length !== 1) {
				ops.select(id, [id]);
			}
			gestures.begin('move', id, event);
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
			const id = store.get().selectedElementId;
			if (id) {
				gestures.begin(kind, id, event, handle);
			}
		},
		closeInline,
		inlineActive: () => inline !== null || tableInline !== null,
		dispose() {
			closeInline(false);
			disposeTableTouch();
			gestures.dispose();
			marquee?.el.remove();
			window.removeEventListener('pointermove', updateMarquee);
			window.removeEventListener('pointerup', finishMarquee);
			window.removeEventListener('pointercancel', finishMarquee);
		},
	};
}
