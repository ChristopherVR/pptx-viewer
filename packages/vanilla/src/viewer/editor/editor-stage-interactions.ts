import {
	drillSelectionForClick,
	drillSelectionForDoubleClick,
	findElementPath,
	isAdditiveSelectionPress,
	isEnterableGroup,
	isGroupMember,
	memberChainAtPoint,
	setPendingCaretPoint,
} from 'pptx-viewer-shared';
import type { PendingInlineTextEdit } from 'pptx-viewer-shared';

import type { ViewerState } from '../state';
import { findActiveElement, getActiveElements } from './editor-active-elements';
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
import {
	inlineTextTargetIsCurrent,
	inlineTextEditTarget,
	inlineTextCollaboration,
	observeInlineTextModel,
	pendingInlineTextModel,
	retainAcceptedInlineTextModel,
} from './inline-text-model';
import { createShapeAdjustGesture } from './shape-adjust-gesture';
import { handleStructuredDblClick } from './structured-dblclick';
import type { TableCellEditorSession } from './table-cell-editor';
import { bindTableTouchEditor } from './table-touch-editor';

export function createStageInteractions(deps: StageInteractionsDeps): StageInteractions {
	const { doc, store, ops } = deps;
	let inline: InlineEditorSession | null = null;
	let inlineTarget: PendingInlineTextEdit['target'] | undefined;
	let modelObserver: ReturnType<typeof observeInlineTextModel> | undefined;
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

	/**
	 * The ids under the pointer inside the top-level group `id`, innermost first
	 * and `id` last (shared `memberChainAtPoint`: geometric, since grouped
	 * children never receive the pointer). Null when `id` isn't an enterable
	 * group (rotated, flipped, not a group), which then selects as one.
	 */
	const drillChain = (state: ViewerState, id: string, event: MouseEvent): string[] | null => {
		const elements = getActiveElements(state);
		const top = elements.find((element) => element.id === id);
		const point = stagePoint(event as PointerEvent);
		return top && point && isEnterableGroup(top) ? memberChainAtPoint(elements, id, point) : null;
	};

	/**
	 * What a press on the top-level element `id` selects, PowerPoint-style: a
	 * group first, then (once it is selected) the member under the pointer, and
	 * another member of the entered group moves the selection to it.
	 */
	const resolvePressTarget = (state: ViewerState, id: string, event: PointerEvent): string => {
		const chain = drillChain(state, id, event);
		if (!chain) {
			return id;
		}
		const selectedPath = state.selectedElementId
			? findElementPath(getActiveElements(state), state.selectedElementId)
			: null;
		return drillSelectionForClick(chain, selectedPath) ?? id;
	};

	/**
	 * A press on the already-selected group member: when it is released without
	 * dragging, its text opens for editing with the caret where the click
	 * landed (PowerPoint's second click into a card's title).
	 */
	let pendingMemberEdit: { id: string; clientX: number; clientY: number } | null = null;
	const CLICK_SLOP_PX = 4;
	// On the window, armed AFTER the move gesture's own pointerup listener, so the
	// gesture has closed (a plain tap commits nothing) before the editor opens.
	const pointerWindow = (): Window | null => doc.defaultView;
	const onPendingMemberEditUp = (event: PointerEvent): void => {
		pointerWindow()?.removeEventListener('pointerup', onPendingMemberEditUp);
		const pending = pendingMemberEdit;
		pendingMemberEdit = null;
		if (
			!pending ||
			Math.abs(event.clientX - pending.clientX) > CLICK_SLOP_PX ||
			Math.abs(event.clientY - pending.clientY) > CLICK_SLOP_PX ||
			store.get().selectedElementId !== pending.id
		) {
			return;
		}
		enterInlineEdit(pending.id, event);
	};
	const armPendingMemberEdit = (id: string, event: PointerEvent): void => {
		pendingMemberEdit = { id, clientX: event.clientX, clientY: event.clientY };
		const win = pointerWindow();
		win?.removeEventListener('pointerup', onPendingMemberEditUp);
		win?.addEventListener('pointerup', onPendingMemberEditUp);
	};
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
		if (commit) {
			session?.commit();
		} else {
			session?.cancel();
		}
	};

	const readInlineList = () => modelObserver?.read() ?? inline?.readList();

	/**
	 * Find this element's own rendered node on the stage (not the inline
	 * editor's, which lives in the separate overlay layer).
	 */
	const findStageElementNode = (id: string): Element | null =>
		deps.getStageRoot()?.querySelector(`[data-element-id="${CSS.escape(id)}"]`) ?? null;

	/**
	 * While the inline text editor is open over an element, hide that one
	 * element's own static text render (the `.pptxv-text` / `.pptxv-warped-text`
	 * child `text-shape.ts` builds) so it does not sit duplicated underneath the
	 * editor's live text - the editor's surface has no opaque backdrop of its
	 * own, so without this the two rendered simultaneously, offset by their
	 * differing box models, producing a "text shadow" (issue #182 in the other
	 * bindings, which hid it behind a translucent/opaque editor background
	 * instead of suppressing the duplicate at the source).
	 */
	const setStaticTextSuppressed = (id: string, suppressed: boolean): void => {
		findStageElementNode(id)?.classList.toggle('pptxv-inline-editing-source', suppressed);
	};

	/** `caret`: the click that opens the editor, where its caret goes (else at the end). */
	const enterInlineEdit = (id: string, caret?: { clientX: number; clientY: number }): void => {
		const state = store.get();
		const el = findActiveElement(state, id);
		const overlay = deps.getOverlay();
		if (!el || !canInlineEditElement(el) || !overlay || inline) {
			return;
		}
		ops.select(id);
		setPendingCaretPoint(caret ?? null);
		overlay.setEditing(true);
		setStaticTextSuppressed(id, true);
		inlineTarget = inlineTextEditTarget(state);
		inline = openInlineEditor({
			doc,
			overlayRoot: overlay.root,
			box: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 },
			scale: deps.getScale(),
			element: el,
			spellCheck: state.spellCheckEnabled,
			collaboration: inlineTextCollaboration(state, id, deps.getLivePatcher?.()),
			onInput: (text) => deps.onInlineTextInput?.(id, text),
			onCommit: (text, snapshot) => {
				// Flush the queued live-preview frame first so it cannot land after
				// the committed text and revert it.
				deps.flushInlineTextInput?.();
				ops.commitInlineText(id, text, snapshot);
			},
			onSelectionChange: (selection) => store.set({ selectedTextRange: selection }),
			onLiveFormatKey: deps.onInlineLiveFormatKey,
			onClose() {
				inline = null;
				inlineTarget = undefined;
				modelObserver = undefined;
				deps.getOverlay()?.setEditing(false);
				setStaticTextSuppressed(id, false);
			},
		});
		modelObserver = observeInlineTextModel(
			el,
			() => inline,
			() => findActiveElement(store.get(), id),
			() => closeInline(false),
			() =>
				inlineTextTargetIsCurrent(store.get(), inlineTarget) &&
				state.editTemplateMode === store.get().editTemplateMode,
		);
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
		// A double-click on a group goes straight to the innermost shape under the
		// pointer, so its text can be edited without ungrouping (PowerPoint).
		const chain = id ? drillChain(state, id, event) : null;
		const target = (chain ? drillSelectionForDoubleClick(chain) : null) ?? id;
		if (target && isElementIdSelectable(state, target)) {
			if (target !== id) {
				ops.select(target);
			}
			// Caret at the END, as for any double-click (typing appends).
			enterInlineEdit(target);
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
			// A press on a group selects the group, then the member under the pointer
			// (shared `group-drill`); `id` stays the top-level hit.
			const target = resolvePressTarget(state, id, event);
			if (!isElementIdSelectable(state, target)) {
				return;
			}
			// A click (no drag) on the member that is already selected edits its text.
			const editOnRelease =
				state.selectedElementId === target &&
				state.selectedElementIds.length === 1 &&
				isGroupMember(getActiveElements(state), target) &&
				canInlineEditElement(findActiveElement(state, target));
			if (state.selectedElementId !== target || state.selectedElementIds.length !== 1) {
				ops.select(target, [target]);
			}
			// A `noMove` shape stays SELECTABLE (so it can be unlocked from the
			// inspector) but must never arm the drag.
			if (canBeginMoveGesture(store.get(), target)) {
				event.preventDefault();
				event.stopPropagation();
				gestures.begin('move', target, event);
			}
			if (editOnRelease) {
				armPendingMemberEdit(target, event);
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
			event.preventDefault();
			event.stopPropagation();
			gestures.begin(kind, id, event, handle);
		},
		beginAdjustGesture: (event, descriptor) => adjustGesture.begin(event, descriptor),
		closeInline,
		readInlineList,
		retainAcceptedInlineText() {
			const slides = retainAcceptedInlineTextModel(store.get(), inlineTarget, inline);
			if (slides) {
				store.set({ slides });
			}
		},
		formatInlineList: (snapshot) => modelObserver?.format(snapshot) ?? false,
		readPendingInlineTextEdit: () =>
			pendingInlineTextModel(store.get(), inlineTarget, readInlineList()),
		hasActivePointerInteraction: () =>
			gestures.isActive() || adjustGesture.isActive() || marquee.isActive(),
		inlineActive: () => inline !== null || tableInline !== null,
		dispose() {
			pointerWindow()?.removeEventListener('pointerup', onPendingMemberEditUp);
			pendingMemberEdit = null;
			closeInline(false);
			disposeTableTouch();
			gestures.dispose();
			adjustGesture.dispose();
			marquee.dispose();
		},
	};
}
