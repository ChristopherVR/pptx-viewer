import type { ResizeHandleId, SnapLine } from 'pptx-viewer-shared';
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
}

export interface SelectionOverlay {
	/** The overlay root (mount as the last child of the stage wrap). */
	root: HTMLElement;
	/** Append the root to `host` when not already its child. */
	mount(host: HTMLElement): void;
	/** Position the selection box (element px + stage scale), or hide it. */
	setBox(box: OverlayBox | null, scale: number): void;
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
	}

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
