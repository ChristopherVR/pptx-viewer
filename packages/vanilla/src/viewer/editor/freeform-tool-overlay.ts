import type { ShapePptxElement } from 'pptx-viewer-core';
import type { FreeformToolKind } from 'pptx-viewer-shared';
import { attachOverlayKeyboard, clientToSlidePoint, FreeformToolSession } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createSvgEl, setSvgAttrs } from '../render';

export interface FreeformToolOverlayOptions {
	doc: Document;
	t: Translator;
	tool: FreeformToolKind;
	canvasSize: { width: number; height: number };
	scale: number;
	/** Insert the finished shape (the tool then disarms). */
	onCommit(element: ShapePptxElement): void;
	/** The gesture ended without a shape; disarm. */
	onCancel(): void;
}

export interface FreeformToolOverlay {
	readonly tool: FreeformToolKind;
	readonly root: SVGSVGElement;
	mount(stage: HTMLElement | null): void;
	update(canvasSize: { width: number; height: number }, scale: number): void;
	destroy(): void;
}

const INK = '#2f528f';

/**
 * The capture layer of the click-to-place Freeform: Shape and Curve tools.
 * The gesture itself (corners, freehand runs, smooth spans, closing on the
 * start point, double-click / Enter / Escape) is the shared
 * `FreeformToolSession`; this only paints its preview and forwards events.
 */
export function createFreeformToolOverlay(
	options: FreeformToolOverlayOptions,
): FreeformToolOverlay {
	const { doc, t, tool } = options;
	let canvasSize = options.canvasSize;
	const root = createSvgEl(doc, 'svg', {
		role: 'application',
		'aria-label': t('pptx.freeformTool.overlay'),
		'data-pptx-freeform-tool-overlay': tool,
	});
	root.style.position = 'absolute';
	root.style.left = '0';
	root.style.top = '0';
	root.style.zIndex = '60';
	root.style.cursor = 'crosshair';
	root.style.touchAction = 'none';

	// The hit rect stays the same node for the overlay's whole life: replacing
	// it on every preview repaint reset the browser's click count, so the
	// second click of a double-click never produced a `dblclick`.
	const hitRect = createSvgEl(doc, 'rect', { width: '100%', height: '100%', fill: 'transparent' });
	const preview = createSvgEl(doc, 'g', { 'pointer-events': 'none' });
	root.append(hitRect, preview);

	const render = (): void => {
		setSvgAttrs(root, { width: canvasSize.width, height: canvasSize.height });
		const view = session.view();
		preview.replaceChildren();
		if (view.previewD) {
			preview.appendChild(
				createSvgEl(doc, 'path', {
					d: view.previewD,
					fill: 'none',
					stroke: INK,
					'stroke-width': view.strokeWidth,
					'pointer-events': 'none',
				}),
			);
		}
		if (view.start) {
			preview.appendChild(
				createSvgEl(doc, 'circle', {
					cx: view.start.x,
					cy: view.start.y,
					r: view.start.size / 2,
					fill: view.start.armed ? INK : '#ffffff',
					stroke: INK,
					'stroke-width': view.strokeWidth,
					'pointer-events': 'none',
					'data-pptx-freeform-start': view.start.armed ? 'armed' : 'idle',
				}),
			);
		}
	};

	const session: FreeformToolSession = new FreeformToolSession({
		tool,
		onCommit: (element) => options.onCommit(element),
		onCancel: () => options.onCancel(),
		onChange: () => render(),
	});
	session.setScale(options.scale);

	const point = (event: MouseEvent) =>
		clientToSlidePoint(root, event.clientX, event.clientY, canvasSize.width, canvasSize.height);
	root.addEventListener('pointerdown', (event) => {
		event.stopPropagation();
		event.preventDefault();
		root.setPointerCapture?.(event.pointerId);
		session.pointerDown({ ...point(event), button: event.button });
	});
	root.addEventListener('pointermove', (event) => session.pointerMove(point(event)));
	root.addEventListener('pointerup', (event) => {
		if (root.hasPointerCapture?.(event.pointerId)) {
			root.releasePointerCapture(event.pointerId);
		}
		session.pointerUp();
	});
	root.addEventListener('dblclick', (event) => {
		event.stopPropagation();
		session.doubleClick();
	});
	root.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	for (const type of ['mousedown', 'click']) {
		root.addEventListener(type, (event) => event.stopPropagation());
	}

	const detachKeyboard = doc.defaultView
		? attachOverlayKeyboard(session, doc.defaultView)
		: () => undefined;
	render();

	return {
		tool,
		root,
		mount(stage) {
			if (!stage) {
				root.remove();
			} else if (root.parentElement !== stage) {
				stage.appendChild(root);
			}
		},
		update(nextCanvasSize, scale) {
			canvasSize = nextCanvasSize;
			session.setScale(scale);
			render();
		},
		destroy() {
			detachKeyboard();
			root.remove();
		},
	};
}
