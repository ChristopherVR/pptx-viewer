import type { PptxElement } from 'pptx-viewer-core';
import type {
	EditPointsCommandId,
	EditPointsElementPatch,
	EditPointsView,
} from 'pptx-viewer-shared';
import {
	attachOverlayKeyboard,
	EDIT_POINTS_STYLE,
	EDIT_POINTS_TARGET_ATTR,
	EditPointsSession,
	overlayPointerInput,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createSvgEl, setSvgAttrs } from '../render';
import { createEditPointsMenuElement } from './edit-points-menu-view';

export interface EditPointsOverlayOptions {
	doc: Document;
	t: Translator;
	element: PptxElement;
	canvasSize: { width: number; height: number };
	scale: number;
	hiddenCommands?: ReadonlySet<EditPointsCommandId>;
	/** Apply one edit (one undo step). */
	onCommit(elementId: string, patch: EditPointsElementPatch): void;
	/** The session ended (Escape, click away, Exit Edit Points). */
	onExit(): void;
}

export interface EditPointsOverlay {
	readonly elementId: string;
	readonly root: SVGSVGElement;
	/** Append to the scaled stage (the stage is rebuilt on every render). */
	mount(stage: HTMLElement | null): void;
	/** Follow the element (and stage size / zoom) after any store change. */
	update(element: PptxElement, canvasSize: { width: number; height: number }, scale: number): void;
	destroy(): void;
}

/** Paint `view` into `root` (children are rebuilt on every change). */
function paint(doc: Document, root: SVGSVGElement, view: EditPointsView): void {
	root.replaceChildren();
	const target = (id: string): Record<string, string> => ({ [EDIT_POINTS_TARGET_ATTR]: id });
	root.appendChild(
		createSvgEl(doc, 'rect', { width: '100%', height: '100%', fill: 'transparent' }),
	);
	for (const seg of view.segments) {
		const hit = createSvgEl(doc, 'path', {
			d: seg.d,
			fill: 'none',
			stroke: 'transparent',
			'stroke-width': view.hitStrokeWidth,
			'pointer-events': 'stroke',
			...target(seg.target),
		});
		hit.style.cursor = 'copy';
		root.appendChild(hit);
	}
	root.appendChild(
		createSvgEl(doc, 'path', {
			d: view.outlineD,
			fill: 'none',
			stroke: EDIT_POINTS_STYLE.outlineColor,
			'stroke-width': view.outlineWidth,
			'pointer-events': 'none',
		}),
	);
	for (const h of view.handles) {
		root.appendChild(
			createSvgEl(doc, 'line', {
				x1: h.anchorX,
				y1: h.anchorY,
				x2: h.x,
				y2: h.y,
				stroke: EDIT_POINTS_STYLE.handleLineColor,
				'stroke-width': view.outlineWidth,
				'pointer-events': 'none',
			}),
		);
		const square = createSvgEl(doc, 'rect', {
			x: h.x - h.size / 2,
			y: h.y - h.size / 2,
			width: h.size,
			height: h.size,
			fill: EDIT_POINTS_STYLE.handleFill,
			stroke: EDIT_POINTS_STYLE.handleStroke,
			'stroke-width': view.outlineWidth,
			...target(h.target),
		});
		square.style.cursor = 'move';
		root.appendChild(square);
	}
	for (const n of view.nodes) {
		const node = createSvgEl(doc, 'rect', {
			x: n.x - n.size / 2,
			y: n.y - n.size / 2,
			width: n.size,
			height: n.size,
			fill: n.selected ? EDIT_POINTS_STYLE.selectedNodeFill : EDIT_POINTS_STYLE.nodeFill,
			stroke: n.selected ? EDIT_POINTS_STYLE.selectedNodeStroke : EDIT_POINTS_STYLE.nodeStroke,
			'stroke-width': view.outlineWidth,
			'data-pptx-edit-points-node-type': n.type,
			'data-selected': n.selected ? 'true' : undefined,
			...target(n.target),
		});
		node.style.cursor = 'move';
		root.appendChild(node);
	}
}

/**
 * PowerPoint's Edit Points mode for one shape.
 *
 * Everything that decides behaviour lives in the shared `EditPointsSession`
 * (hit targets, drags, the vertex / segment menu, keyboard, the element
 * patch); this only paints its view descriptor as SVG in the stage's unscaled
 * slide-pixel space and forwards pointer events to it.
 */
export function createEditPointsOverlay(options: EditPointsOverlayOptions): EditPointsOverlay {
	const { doc, t } = options;
	const elementId = options.element.id;
	let canvasSize = options.canvasSize;
	let scale = options.scale;
	let menuEl: HTMLElement | null = null;
	let stageEl: HTMLElement | null = null;

	const root = createSvgEl(doc, 'svg', {
		role: 'application',
		'aria-label': t('pptx.editPoints.overlay'),
		'data-pptx-edit-points-overlay': 'true',
		'data-pptx-edit-points-element': elementId,
	});
	root.style.position = 'absolute';
	root.style.left = '0';
	root.style.top = '0';
	root.style.zIndex = '60';
	root.style.touchAction = 'none';

	const render = (): void => {
		setSvgAttrs(root, { width: canvasSize.width, height: canvasSize.height });
		const view = session.view(scale);
		paint(doc, root, view);
		menuEl?.remove();
		menuEl = view.menu
			? createEditPointsMenuElement(doc, t, view.menu, (id) => session.runCommand(id))
			: null;
		if (menuEl && stageEl) {
			stageEl.appendChild(menuEl);
		}
	};

	const session: EditPointsSession = new EditPointsSession(options.element, {
		onCommit: (patch) => options.onCommit(elementId, patch),
		onExit: () => options.onExit(),
		onChange: () => render(),
		hiddenCommands: options.hiddenCommands,
	});

	const input = (event: MouseEvent) =>
		overlayPointerInput(event, root, canvasSize.width, canvasSize.height);
	root.addEventListener('pointerdown', (event) => {
		event.stopPropagation();
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		root.setPointerCapture?.(event.pointerId);
		session.pointerDown(input(event));
	});
	root.addEventListener('pointermove', (event) => session.pointerMove(input(event)));
	root.addEventListener('pointerup', (event) => {
		if (root.hasPointerCapture?.(event.pointerId)) {
			root.releasePointerCapture(event.pointerId);
		}
		session.pointerUp(input(event));
	});
	root.addEventListener('contextmenu', (event) => {
		event.preventDefault();
		event.stopPropagation();
		session.contextMenu(input(event));
	});
	for (const type of ['mousedown', 'click', 'dblclick']) {
		root.addEventListener(type, (event) => event.stopPropagation());
	}

	const detachKeyboard = doc.defaultView
		? attachOverlayKeyboard(session, doc.defaultView)
		: () => undefined;
	render();

	return {
		elementId,
		root,
		mount(stage) {
			stageEl = stage;
			if (!stage) {
				root.remove();
				menuEl?.remove();
				return;
			}
			if (root.parentElement !== stage) {
				stage.appendChild(root);
			}
			if (menuEl && menuEl.parentElement !== stage) {
				stage.appendChild(menuEl);
			}
		},
		update(element, nextCanvasSize, nextScale) {
			const resized =
				nextScale !== scale ||
				nextCanvasSize.width !== canvasSize.width ||
				nextCanvasSize.height !== canvasSize.height;
			canvasSize = nextCanvasSize;
			scale = nextScale;
			// `reconcile` re-renders through onChange only when the element really
			// changed underneath the session; a zoom change needs its own repaint.
			session.reconcile(element);
			if (resized) {
				render();
			}
		},
		destroy() {
			detachKeyboard();
			root.remove();
			menuEl?.remove();
			menuEl = null;
		},
	};
}
