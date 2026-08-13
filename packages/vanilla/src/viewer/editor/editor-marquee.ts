import {
	computeMarqueeHitIds,
	isAdditiveSelectionPress,
	mergeAdditiveSelection,
} from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements } from './editor-active-elements';
import { interactableIds } from './editor-lock-gates';
import type { EditorOps } from './editor-operations';

/**
 * The rubber-band (marquee) selection gesture: a press that lands on empty
 * canvas (or on an element the user may not select) drags a box, and every
 * element it intersects is selected on release.
 *
 * Extracted from `editor-stage-interactions.ts` so that file stays a thin
 * router; the hit maths itself lives in shared (`computeMarqueeHitIds`).
 */

export interface MarqueeControllerDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
	getScale(): number;
	/** The overlay layer the band is drawn into (screen space, unscaled). */
	getOverlayRoot(): HTMLElement | null;
	/** Slide-space point for a pointer event, or null when unresolvable. */
	stagePoint(event: PointerEvent): { x: number; y: number } | null;
}

export interface MarqueeController {
	/** Start a band from a pointerdown on empty canvas. */
	begin(event: PointerEvent): void;
	/** Tear down any in-flight band and its window listeners. */
	dispose(): void;
}

interface ActiveMarquee {
	pointerId: number;
	startX: number;
	startY: number;
	additive: boolean;
	el: HTMLElement;
}

export function createMarqueeController(deps: MarqueeControllerDeps): MarqueeController {
	const { doc, store, ops } = deps;
	let marquee: ActiveMarquee | null = null;

	const detach = (): void => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onEnd);
		window.removeEventListener('pointercancel', onEnd);
	};

	function onMove(event: PointerEvent): void {
		if (!marquee || event.pointerId !== marquee.pointerId) {
			return;
		}
		const point = deps.stagePoint(event);
		if (!point) {
			return;
		}
		const scale = deps.getScale();
		marquee.el.style.left = `${Math.min(marquee.startX, point.x) * scale}px`;
		marquee.el.style.top = `${Math.min(marquee.startY, point.y) * scale}px`;
		marquee.el.style.width = `${Math.abs(point.x - marquee.startX) * scale}px`;
		marquee.el.style.height = `${Math.abs(point.y - marquee.startY) * scale}px`;
	}

	function onEnd(event: PointerEvent): void {
		if (!marquee || event.pointerId !== marquee.pointerId) {
			return;
		}
		const point = deps.stagePoint(event);
		const state = store.get();
		// A band that sweeps over an `a:spLocks/@noSelect` shape must skip it, the
		// same way a direct press on it does.
		const hits = point
			? interactableIds(
					state,
					computeMarqueeHitIds(
						{
							startX: marquee.startX,
							startY: marquee.startY,
							currentX: point.x,
							currentY: point.y,
						},
						getActiveElements(state),
					),
					'select',
				)
			: [];
		const ids = marquee.additive ? mergeAdditiveSelection(state.selectedElementIds, hits) : hits;
		marquee.el.remove();
		marquee = null;
		detach();
		ops.select(ids.at(-1) ?? null, ids);
	}

	return {
		begin(event) {
			const point = deps.stagePoint(event);
			const overlayRoot = deps.getOverlayRoot();
			if (!point || !overlayRoot) {
				return;
			}
			const el = doc.createElement('div');
			el.className = 'pptxv-marquee';
			overlayRoot.appendChild(el);
			marquee = {
				pointerId: event.pointerId,
				startX: point.x,
				startY: point.y,
				additive: isAdditiveSelectionPress(event),
				el,
			};
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onEnd);
			window.addEventListener('pointercancel', onEnd);
		},
		dispose() {
			marquee?.el.remove();
			marquee = null;
			detach();
		},
	};
}
