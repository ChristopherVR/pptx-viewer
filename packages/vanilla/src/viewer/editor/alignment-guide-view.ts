import type { Guide } from 'pptx-viewer-shared';

/**
 * Draw/remove one guide's callbacks. Passed only while dragging is meaningful
 * (editable, not presenting); omitting them renders the guides as static
 * lines (View > Guides read-only preview, matching the pre-interaction
 * behaviour).
 */
export interface AlignmentGuideCallbacks {
	/** A drag moved the guide (pointer position converted to slide pixels). */
	onMoveGuide(id: string, position: number): void;
	/** The guide's line was double-clicked (React/Vue's delete gesture). */
	onRemoveGuide(id: string): void;
}

/**
 * Live per-element drag state, keyed by the guide's DOM node rather than
 * captured in the `pointerdown` closure: the node is REUSED across syncs (see
 * below), so a value captured at creation time would go stale the moment the
 * zoom level or the guide's own position changed.
 */
interface GuideLineState {
	id: string;
	axis: Guide['axis'];
	scale: number;
}

const guideLineState = new WeakMap<HTMLElement, GuideLineState>();

function wireGuideInteraction(line: HTMLElement, callbacks: AlignmentGuideCallbacks): void {
	line.addEventListener('pointerdown', (event) => {
		event.stopPropagation();
		line.setPointerCapture(event.pointerId);
	});
	line.addEventListener('pointermove', (event) => {
		if (!line.hasPointerCapture(event.pointerId)) {
			return;
		}
		const info = guideLineState.get(line);
		// offsetParent is the position:relative stage; its rect is the scaled box
		// (mirrors Vue's `CanvasGuides.vue`, the reference for this gesture).
		const stage = line.offsetParent;
		if (!info || !stage) {
			return;
		}
		const rect = stage.getBoundingClientRect();
		const scale = info.scale || 1;
		const position =
			info.axis === 'h' ? (event.clientY - rect.top) / scale : (event.clientX - rect.left) / scale;
		callbacks.onMoveGuide(info.id, position);
	});
	line.addEventListener('pointerup', (event) => {
		try {
			line.releasePointerCapture(event.pointerId);
		} catch {
			// Capture may already have been released by the browser.
		}
	});
	line.addEventListener('dblclick', (event) => {
		event.stopPropagation();
		const info = guideLineState.get(line);
		if (info) {
			callbacks.onRemoveGuide(info.id);
		}
	});
}

/**
 * Render the View > Guides alignment lines, reconciled by `guide.id` rather
 * than torn down and rebuilt every call.
 *
 * A drag calls `onMoveGuide` on every `pointermove`, which re-enters this
 * function through the normal render cycle; a naive "remove every
 * `.pptxv-alignment-guide` then recreate" (the pre-interactive
 * implementation) would replace the very element that holds pointer capture
 * mid-drag, silently ending the gesture after its first move. Reusing the
 * existing DOM node for a guide id that is still present keeps the capture
 * alive across that re-render, the same guarantee React's keyed reconciler
 * and Vue's `v-for :key` give their own `CanvasGuides` for free.
 */
export function syncAlignmentGuides(
	doc: Document,
	root: HTMLElement,
	guides: Guide[],
	scale: number,
	callbacks?: AlignmentGuideCallbacks,
): void {
	const existing = new Map<string, HTMLElement>();
	root.querySelectorAll<HTMLElement>('.pptxv-alignment-guide').forEach((el) => {
		const id = el.dataset.guideId;
		if (id !== undefined) {
			existing.set(id, el);
		}
	});
	const seen = new Set<string>();
	for (const guide of guides) {
		seen.add(guide.id);
		let line = existing.get(guide.id);
		if (!line) {
			line = doc.createElement('div');
			line.dataset.guideId = guide.id;
			if (callbacks) {
				wireGuideInteraction(line, callbacks);
			}
			root.appendChild(line);
		}
		line.className = `pptxv-alignment-guide is-${guide.axis}${callbacks ? ' is-interactive' : ''}`;
		line.style[guide.axis === 'h' ? 'top' : 'left'] = `${guide.position * scale}px`;
		guideLineState.set(line, { id: guide.id, axis: guide.axis, scale });
	}
	for (const [id, el] of existing) {
		if (!seen.has(id)) {
			guideLineState.delete(el);
			el.remove();
		}
	}
}
