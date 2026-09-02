import type { PptxElement } from 'pptx-viewer-core';
import {
	applyResize,
	computeMarqueeHitIds,
	mergeAdditiveSelection,
	moveSelection,
	resizeSelection,
	selectionBounds,
} from 'pptx-viewer-shared';
import type {
	ElementBoxPatch,
	InteractionBox,
	MarqueeRect,
	ResizeHandleId,
} from 'pptx-viewer-shared';

export interface EditorMarqueeRect extends MarqueeRect {
	additive: boolean;
}

export interface SelectionGestureDeps {
	getScale(): number;
	getStageRect(): DOMRect | undefined;
	getElements(): readonly PptxElement[];
	getSelectedIds(): readonly string[];
	/**
	 * The selected ids a collective `interaction` may actually act on, with the
	 * locked members already dropped. Optional: without it the whole selection
	 * transforms, which is the pre-lock behaviour.
	 */
	getTransformIds?(interaction: 'move' | 'resize'): readonly string[];
	onStart(): void;
	onPatch(id: string, patch: ElementBoxPatch): void;
	/** `movedIds` are the elements this gesture actually patched. */
	onCommit(movedIds: readonly string[]): void;
	onSelect(ids: readonly string[]): void;
	onMarquee(rect: EditorMarqueeRect | null): void;
}

type Gesture =
	| { kind: 'marquee'; pointerId: number; rect: EditorMarqueeRect; base: readonly string[] }
	| {
			kind: 'move' | 'resize';
			pointerId: number;
			startX: number;
			startY: number;
			boxes: Array<PptxElement & InteractionBox>;
			bounds: InteractionBox;
			handle?: ResizeHandleId;
			moved: boolean;
	  };

const DEAD_ZONE = 2;

/** Window-level marquee and collective transform driver for the Svelte stage. */
export function createSelectionGestureController(deps: SelectionGestureDeps) {
	let active: Gesture | null = null;

	function point(event: PointerEvent): { x: number; y: number } {
		const rect = deps.getStageRect();
		const scale = deps.getScale() || 1;
		return {
			x: Math.max(
				0,
				Math.min(
					rect?.width ? rect.width / scale : Infinity,
					(event.clientX - (rect?.left ?? 0)) / scale,
				),
			),
			y: Math.max(
				0,
				Math.min(
					rect?.height ? rect.height / scale : Infinity,
					(event.clientY - (rect?.top ?? 0)) / scale,
				),
			),
		};
	}

	function onMove(event: PointerEvent): void {
		if (!active || event.pointerId !== active.pointerId) {
			return;
		}
		if (active.kind === 'marquee') {
			const next = point(event);
			active.rect = { ...active.rect, currentX: next.x, currentY: next.y };
			deps.onMarquee(active.rect);
			return;
		}
		const dx = (event.clientX - active.startX) / (deps.getScale() || 1);
		const dy = (event.clientY - active.startY) / (deps.getScale() || 1);
		if (!active.moved && Math.abs(dx) <= DEAD_ZONE && Math.abs(dy) <= DEAD_ZONE) {
			return;
		}
		if (!active.moved) {
			active.moved = true;
			deps.onStart();
		}
		const boxes =
			active.kind === 'move'
				? moveSelection(active.boxes, dx, dy)
				: resizeSelection(
						active.boxes,
						active.bounds,
						applyResize(
							active.bounds,
							active.handle ?? 'se',
							dx * deps.getScale(),
							dy * deps.getScale(),
							deps.getScale(),
						),
					);
		for (const box of boxes) {
			deps.onPatch(box.id, { ...box, rotation: box.rotation ?? 0 });
		}
	}

	function onUp(event: PointerEvent): void {
		if (!active || event.pointerId !== active.pointerId) {
			return;
		}
		const done = active;
		detach();
		active = null;
		if (done.kind === 'marquee') {
			const hit = computeMarqueeHitIds(done.rect, deps.getElements());
			deps.onSelect(done.rect.additive ? mergeAdditiveSelection(done.base, hit) : hit);
			deps.onMarquee(null);
		} else if (done.moved) {
			deps.onCommit(done.boxes.map((box) => box.id));
		}
	}

	function detach(): void {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onUp);
		window.removeEventListener('pointercancel', onUp);
	}

	function attach(): void {
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}

	return {
		beginMarquee(event: PointerEvent): void {
			const start = point(event);
			const rect = {
				startX: start.x,
				startY: start.y,
				currentX: start.x,
				currentY: start.y,
				additive: event.shiftKey || event.ctrlKey || event.metaKey,
			};
			active = { kind: 'marquee', pointerId: event.pointerId, rect, base: deps.getSelectedIds() };
			deps.onMarquee(rect);
			attach();
		},
		beginTransform(kind: 'move' | 'resize', event: PointerEvent, handle?: ResizeHandleId): boolean {
			// A locked member stays put while its unlocked neighbours travel, which
			// is what PowerPoint does; the filter is the shared lock decision, not a
			// second opinion held here.
			const ids = new Set(deps.getTransformIds?.(kind) ?? deps.getSelectedIds());
			const boxes = deps.getElements().filter((element) => ids.has(element.id));
			const bounds = selectionBounds(boxes);
			if (boxes.length < 2 || !bounds) {
				return false;
			}
			event.preventDefault();
			event.stopPropagation();
			active = {
				kind,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				boxes,
				bounds,
				handle,
				moved: false,
			};
			attach();
			return true;
		},
		dispose(): void {
			detach();
			active = null;
		},
	};
}
