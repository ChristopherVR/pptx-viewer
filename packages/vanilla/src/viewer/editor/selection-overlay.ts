import type { ResizeHandleId, ShapeAdjustmentHandleDescriptor, SnapLine } from 'pptx-viewer-shared';
import { RESIZE_HANDLE_GEOMETRY, RESIZE_HANDLES, ROTATE_STEM_PX } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

/**
 * The selection overlay: a screen-space layer positioned over the slide stage
 * (a sibling of the rendered stage inside `stageWrap`, NEVER inside the
 * element renderers) that draws the selected element's box, its 8 resize
 * handles, the rotate handle, and transient snap-alignment lines.
 *
 * Unlike the Vue overlay (which lives inside the scaled canvas), this layer is
 * UNSCALED: element geometry is multiplied by the stage scale when positioned,
 * so handles keep a constant on-screen size at any zoom (the "handles shrink
 * inside the zoom transform" bug class the other bindings hit).
 */

/** Box geometry in element (unscaled slide) px. */
export interface OverlayBox {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

export interface SelectionOverlayHooks {
	onHandlePointerDown(handle: ResizeHandleId, event: PointerEvent): void;
	onRotatePointerDown(event: PointerEvent): void;
	/** Pointerdown on ONE of the amber `a:avLst` adjustment diamonds. */
	onAdjustPointerDown(event: PointerEvent, descriptor: ShapeAdjustmentHandleDescriptor): void;
}

/**
 * Which selection chrome the current selection's `a:spLocks` still allow. A
 * pinned (`noMove`) shape keeps its handles; a `noResize` one must not show the
 * eight it cannot use, or the affordance lies about what will happen.
 */
export interface SelectionHandleVisibility {
	resizable: boolean;
	rotatable: boolean;
}

export interface SelectionOverlay {
	/** The overlay root (mount as the last child of the stage wrap). */
	root: HTMLElement;
	/** Append the root to `host` when not already its child. */
	mount(host: HTMLElement): void;
	/** Position the selection box (element px + stage scale), or hide it. */
	setBox(box: OverlayBox | null, scale: number): void;
	/** Show/hide the resize handles and rotate knob per the selection's locks. */
	setHandleVisibility(visibility: SelectionHandleVisibility): void;
	/**
	 * Place the amber shape-adjustment diamonds, in element px: ONE per
	 * `a:avLst` guide, because PowerPoint offers one per adjustable parameter
	 * and most presets have several. An empty list draws none.
	 */
	setAdjustHandles(descriptors: ShapeAdjustmentHandleDescriptor[], scale: number): void;
	/** Render transient snap-alignment lines (element px + stage scale). */
	setSnapLines(lines: readonly SnapLine[], scale: number): void;
	/** Hide the selection chrome while the inline text editor is open. */
	setEditing(editing: boolean): void;
	destroy(): void;
}

export function createSelectionOverlay(
	doc: Document,
	t: Translator,
	hooks: SelectionOverlayHooks,
): SelectionOverlay {
	const root = createEl(doc, 'div', 'pptxv-editor-overlay');

	// The box itself never intercepts pointers (CSS `pointer-events: none`);
	// drag-to-move is driven from the underlying element so clicks reach it.
	const box = createEl(doc, 'div', 'pptxv-sel-box');
	box.hidden = true;
	root.appendChild(box);

	const stem = createEl(doc, 'div', 'pptxv-rotate-stem', {
		left: '50%',
		top: `${-ROTATE_STEM_PX}px`,
		height: `${ROTATE_STEM_PX}px`,
	});
	box.appendChild(stem);

	const knob = createEl(doc, 'button', 'pptxv-rotate-knob', {
		left: '50%',
		top: `${-ROTATE_STEM_PX}px`,
	});
	knob.type = 'button';
	knob.setAttribute('data-pptx-compact', '');
	knob.setAttribute('aria-label', t('pptx.selectionOverlay.rotate'));
	knob.addEventListener('pointerdown', (event) => hooks.onRotatePointerDown(event));
	box.appendChild(knob);

	const resizeHandles: HTMLElement[] = [];
	for (const handle of RESIZE_HANDLES) {
		const { fx, fy } = RESIZE_HANDLE_GEOMETRY[handle];
		const btn = createEl(doc, 'button', 'pptxv-sel-handle', {
			left: `${fx * 100}%`,
			top: `${fy * 100}%`,
			cursor: RESIZE_HANDLE_GEOMETRY[handle].cursor,
		});
		btn.type = 'button';
		btn.setAttribute('data-pptx-compact', '');
		btn.dataset.handle = handle;
		btn.setAttribute('aria-label', t('pptx.selectionOverlay.resize', { handle }));
		btn.addEventListener('pointerdown', (event) => hooks.onHandlePointerDown(handle, event));
		box.appendChild(btn);
		resizeHandles.push(btn);
	}

	// PowerPoint's amber adjustment diamonds (`a:avLst`), created on demand: the
	// count is per-preset (a `callout3` has four), so a single pre-built button
	// could only ever offer the first. Shared decides how many and where.
	const adjustHandles: HTMLButtonElement[] = [];

	/**
	 * Mint one diamond for pool slot `index`.
	 *
	 * Declared outside the growth loop so its listener closes over the SLOT, not
	 * over a loop variable, and reads the descriptor list live: the pool outlives
	 * any one selection, so a button minted for a `roundRect` must act on
	 * whatever guide occupies its slot when a `quadArrow` is selected next.
	 */
	function addAdjustHandleButton(index: number): HTMLButtonElement {
		const button = createEl(doc, 'button', 'pptxv-adjust-handle');
		button.type = 'button';
		button.setAttribute('data-pptx-compact', '');
		button.setAttribute('aria-label', t('pptx.selectionOverlay.adjust'));
		button.addEventListener('pointerdown', (event) => {
			const descriptor = currentAdjustDescriptors[index];
			if (descriptor) {
				hooks.onAdjustPointerDown(event, descriptor);
			}
		});
		box.appendChild(button);
		return button;
	}
	// The descriptors the pool is currently showing, so a button's handler picks
	// the diamond it is CURRENTLY painting rather than one captured at creation.
	let currentAdjustDescriptors: ShapeAdjustmentHandleDescriptor[] = [];

	const linesLayer = createEl(doc, 'div', 'pptxv-snap-layer');
	root.appendChild(linesLayer);

	return {
		root,
		mount(host) {
			if (root.parentElement !== host) {
				host.appendChild(root);
			} else if (host.lastElementChild !== root) {
				// Keep the overlay above a freshly re-rendered stage.
				host.appendChild(root);
			}
		},
		setBox(nextBox, scale) {
			if (!nextBox) {
				box.hidden = true;
				return;
			}
			box.hidden = false;
			box.style.left = `${nextBox.x * scale}px`;
			box.style.top = `${nextBox.y * scale}px`;
			box.style.width = `${nextBox.width * scale}px`;
			box.style.height = `${nextBox.height * scale}px`;
			// Scale the outline width by the stage scale so the selection border
			// tracks the zoom the same way React's does (its border/ring live
			// inside the scaled stage). Without this the unscaled overlay draws a
			// constant 1px screen border that looks far too thick when zoomed out
			// on mobile, where React's has shrunk below 1px.
			box.style.borderWidth = `${scale}px`;
			box.style.transform = nextBox.rotation ? `rotate(${nextBox.rotation}deg)` : 'none';
		},
		setHandleVisibility({ resizable, rotatable }) {
			for (const handle of resizeHandles) {
				handle.hidden = !resizable;
			}
			stem.hidden = !rotatable;
			knob.hidden = !rotatable;
		},
		setAdjustHandles(descriptors, scale) {
			// Grow the pool to match; buttons past the count are hidden rather than
			// destroyed so a drag that changes the shape does not tear out the node
			// the pointer is captured on.
			while (adjustHandles.length < descriptors.length) {
				adjustHandles.push(addAdjustHandleButton(adjustHandles.length));
			}
			currentAdjustDescriptors = descriptors;
			adjustHandles.forEach((button, index) => {
				const descriptor = descriptors[index];
				button.hidden = descriptor === undefined;
				if (!descriptor) {
					return;
				}
				// `left`/`top` are element-local px from the element top-left, and the
				// diamond is a child of the box (already placed at `x * scale`), so the
				// offsets only need the same scale applied.
				button.style.left = `${descriptor.left * scale}px`;
				button.style.top = `${descriptor.top * scale}px`;
				button.style.cursor = descriptor.cursor;
				button.dataset.pptxAdjustKey = descriptor.key;
			});
		},
		setSnapLines(lines, scale) {
			linesLayer.replaceChildren();
			for (const line of lines) {
				const el = createEl(
					doc,
					'div',
					`pptxv-snap-line pptxv-snap-${line.axis === 'v' ? 'v' : 'h'}`,
				);
				if (line.axis === 'v') {
					el.style.left = `${line.position * scale}px`;
				} else {
					el.style.top = `${line.position * scale}px`;
				}
				linesLayer.appendChild(el);
			}
		},
		setEditing(editing) {
			root.classList.toggle('is-editing', editing);
		},
		destroy() {
			root.remove();
		},
	};
}
