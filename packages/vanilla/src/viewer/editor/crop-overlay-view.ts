import type { PptxElement } from 'pptx-viewer-core';
import { buildCropOverlay } from 'pptx-viewer-shared';
import type { CropHandleId, CropOverlayBox } from 'pptx-viewer-shared';

import { createEl } from '../render';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface CropOverlayViewHooks {
	/** Pointer went down on crop handle `handle`. */
	onHandlePointerDown(handle: CropHandleId, event: PointerEvent): void;
	/** Pointer went down on the ghost image or inside the frame (pan). */
	onPanPointerDown(event: PointerEvent): void;
}

export interface CropOverlayView {
	root: HTMLElement;
	/** Re-project the overlay for `element` at stage zoom `zoom`. */
	update(element: PptxElement, zoom: number, src: string | undefined): void;
	/** Append to the scaled stage (re-run after every stage rebuild). */
	mount(stage: HTMLElement | null): void;
	unmount(): void;
}

function placeBox(node: HTMLElement | SVGElement, box: CropOverlayBox): void {
	node.style.left = `${box.left}px`;
	node.style.top = `${box.top}px`;
	node.style.width = `${box.width}px`;
	node.style.height = `${box.height}px`;
}

/**
 * The crop-mode overlay: a layer laid exactly over the picture's box INSIDE
 * the scaled stage (so it rotates and zooms with the picture), drawing the
 * dimmed ghost of the whole image outside the frame, the frame outline and
 * the eight black crop handles. Every size and path is the shared
 * `buildCropOverlay` descriptor; this module only maps it onto DOM nodes,
 * which are built once and updated in place on each frame of a drag.
 */
export function createCropOverlayView(
	doc: Document,
	handleLabel: string,
	hooks: CropOverlayViewHooks,
): CropOverlayView {
	const root = createEl(doc, 'div', 'pptxv-crop-overlay', {
		position: 'absolute',
		overflow: 'visible',
		zIndex: '50',
		pointerEvents: 'none',
	});
	root.dataset.pptxCropOverlay = 'true';

	const ghost = createEl(doc, 'div', 'pptxv-crop-ghost', {
		position: 'absolute',
		pointerEvents: 'auto',
		cursor: 'move',
	});
	const ghostImg = doc.createElement('img');
	ghostImg.alt = '';
	ghostImg.draggable = false;
	Object.assign(ghostImg.style, {
		display: 'block',
		width: '100%',
		height: '100%',
		pointerEvents: 'none',
		userSelect: 'none',
	});
	ghost.appendChild(ghostImg);

	const frame = createEl(doc, 'div', 'pptxv-crop-frame', {
		position: 'absolute',
		boxSizing: 'border-box',
		pointerEvents: 'auto',
		cursor: 'move',
	});
	frame.dataset.pptxCropFrame = 'true';

	const onPan = (event: PointerEvent): void => {
		if (event.button === 0) {
			hooks.onPanPointerDown(event);
		}
	};
	ghost.addEventListener('pointerdown', onPan);
	frame.addEventListener('pointerdown', onPan);
	root.append(ghost, frame);

	const handles = new Map<
		CropHandleId,
		{ node: HTMLElement; path: SVGPathElement; svg: SVGSVGElement }
	>();
	const handleFor = (
		id: CropHandleId,
	): { node: HTMLElement; path: SVGPathElement; svg: SVGSVGElement } => {
		const existing = handles.get(id);
		if (existing) {
			return existing;
		}
		const node = createEl(doc, 'div', 'pptxv-crop-handle', {
			position: 'absolute',
			pointerEvents: 'auto',
			touchAction: 'none',
		});
		node.dataset.pptxCropHandle = id;
		node.setAttribute('role', 'button');
		node.setAttribute('aria-label', handleLabel);
		const svg = doc.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('aria-hidden', 'true');
		Object.assign(svg.style, { position: 'absolute', inset: '0', overflow: 'visible' });
		const path = doc.createElementNS(SVG_NS, 'path');
		path.setAttribute('fill', '#000000');
		path.setAttribute('stroke', '#ffffff');
		svg.appendChild(path);
		node.appendChild(svg);
		node.addEventListener('pointerdown', (event) => {
			if (event.button === 0) {
				hooks.onHandlePointerDown(id, event);
			}
		});
		root.appendChild(node);
		const entry = { node, path, svg };
		handles.set(id, entry);
		return entry;
	};

	return {
		root,
		update(element, zoom, src) {
			const descriptor = buildCropOverlay(element, zoom);
			root.style.left = `${element.x}px`;
			root.style.top = `${element.y}px`;
			root.style.width = `${element.width}px`;
			root.style.height = `${element.height}px`;
			root.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : '';

			placeBox(ghost, descriptor.ghost);
			ghost.style.clipPath = descriptor.ghost.clipPath;
			ghost.style.opacity = String(descriptor.ghost.opacity);
			ghostImg.style.transform = descriptor.ghost.transform;
			if (src && ghostImg.getAttribute('src') !== src) {
				ghostImg.src = src;
			}

			placeBox(frame, descriptor.frame);
			const stroke = zoom > 0 ? 1 / zoom : 1;
			frame.style.outline = `${stroke}px solid rgba(0, 0, 0, 0.6)`;

			for (const handle of descriptor.handles) {
				const entry = handleFor(handle.id);
				placeBox(entry.node, handle);
				entry.node.style.cursor = handle.cursor;
				entry.svg.setAttribute('width', String(handle.width));
				entry.svg.setAttribute('height', String(handle.height));
				entry.path.setAttribute('d', handle.path);
				entry.path.setAttribute('stroke-width', String(stroke));
			}
		},
		mount(stage) {
			if (!stage) {
				root.remove();
				return;
			}
			if (root.parentElement !== stage || stage.lastElementChild !== root) {
				stage.appendChild(root);
			}
		},
		unmount() {
			root.remove();
		},
	};
}
