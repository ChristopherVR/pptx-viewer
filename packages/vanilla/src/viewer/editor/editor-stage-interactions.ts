import type {
	InteractionBox,
	ResizeHandleId,
	SelectionTransformBox,
	SnapSibling,
} from 'pptx-viewer-shared';
import {
	computeMarqueeHitIds,
	isElementIdInteractive,
	mergeAdditiveSelection,
	moveSelection,
	resizeSelection,
	selectionBounds,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { findActiveElement, getActiveElements } from './editor-active-elements';
import { createGestureController } from './editor-gestures';
import type { EditorOps } from './editor-operations';
import { resolveTopLevelElementId } from './element-hit';
import type { InlineEditorSession } from './inline-text-editor';
import { canInlineEditElement, openInlineEditor } from './inline-text-editor';
import type { SelectionOverlay } from './selection-overlay';

export interface StageInteractionsDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
	getScale(): number;
	getOverlay(): SelectionOverlay | null;
	/** The rendered stage element inside the currently-attached wrap. */
	getStageRoot(): Element | null;
	/** Notified with slide-space (unscaled) coordinates on every stage pointer move (collaboration cursor broadcast). */
	onCursorMove?: (x: number, y: number) => void;
}

export interface StageInteractions {
	onStagePointerDown(event: PointerEvent): void;
	onStagePointerMove(event: PointerEvent): void;
	onStageDblClick(event: MouseEvent): void;
	/** Begin a resize/rotate gesture from an overlay handle. */
	beginHandleGesture(kind: 'resize' | 'rotate', event: PointerEvent, handle?: ResizeHandleId): void;
	/** Close the inline editor, committing or cancelling its text. */
	closeInline(commit: boolean): void;
	/** True while an inline text-editing session is open. */
	inlineActive(): boolean;
	dispose(): void;
}

/**
 * The pointer-driven stage interactions (move/resize/rotate gestures and
 * double-click inline text editing), extracted from `editor-controller` so
 * the orchestrator stays within the file-size budget. All state transitions
 * still flow through the history-tracked `EditorOps`.
 */
export function createStageInteractions(deps: StageInteractionsDeps): StageInteractions {
	const { doc, store, ops } = deps;
	let inline: InlineEditorSession | null = null;
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
		getSiblings(): SnapSibling[] {
			const state = store.get();
			return getActiveElements(state).map(({ id, x, y, width, height }) => ({
				id,
				x,
				y,
				width,
				height,
			}));
		},
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

	const stagePoint = (event: PointerEvent): { x: number; y: number } | null => {
		const rect = deps.getOverlay()?.root.getBoundingClientRect();
		const scale = deps.getScale();
		return rect && scale > 0
			? { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale }
			: null;
	};
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

	const closeInline = (commit: boolean): void => {
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
			onCommit: (text) => ops.commitInlineText(id, text),
			onClose() {
				inline = null;
				deps.getOverlay()?.setEditing(false);
			},
		});
	};

	return {
		onStagePointerDown(event) {
			const state = store.get();
			if (!state.editable || state.presenting || event.button !== 0 || inline) {
				return;
			}
			const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
			if (state.formatPainterSourceId) {
				if (id && isElementIdInteractive(id, state.editTemplateMode)) {
					ops.applyFormatPainter(state.formatPainterSourceId, id);
				}
				store.set({ formatPainterSourceId: null });
				return;
			}
			if (!id || !isElementIdInteractive(id, state.editTemplateMode)) {
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
			if (!state.editable || state.presenting) {
				return;
			}
			const id = resolveTopLevelElementId(event.target, deps.getStageRoot());
			if (id && isElementIdInteractive(id, state.editTemplateMode)) {
				enterInlineEdit(id);
			}
		},
		beginHandleGesture(kind, event, handle) {
			const id = store.get().selectedElementId;
			if (id) {
				gestures.begin(kind, id, event, handle);
			}
		},
		closeInline,
		inlineActive: () => inline !== null,
		dispose() {
			gestures.dispose();
			marquee?.el.remove();
			window.removeEventListener('pointermove', updateMarquee);
			window.removeEventListener('pointerup', finishMarquee);
			window.removeEventListener('pointercancel', finishMarquee);
		},
	};
}
