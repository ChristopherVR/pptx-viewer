/**
 * Mounts the shared `pptx-ui-context-menu` for the Vanilla viewer's menus.
 *
 * Each menu (element, canvas, slide thumbnail, slide show, AI) keeps its own
 * entries, gating and command routing; this is the one place that creates the
 * element, hands it state and wires its typed events. The element owns the rows,
 * keyboard navigation, positioning, Escape/outside dismissal and focus restore.
 */
import { registerPptxWebControls } from 'pptx-viewer-shared';
import type { ContextMenuViewState, PptxUiContextMenuElement } from 'pptx-viewer-shared';

export interface ContextMenuSurfaceOptions {
	doc: Document;
	/** Where the element is mounted: the viewer root, so host theme variables apply. */
	parent: HTMLElement;
	state: ContextMenuViewState;
	/** A row was activated; the menu stays open until `close()` is called. */
	onRequest(id: string): void;
	/** The user dismissed the menu (Escape, an outside press, Tab). */
	onClose(): void;
}

export interface ContextMenuSurface {
	readonly element: PptxUiContextMenuElement;
	close(): void;
}

export function mountContextMenuSurface(options: ContextMenuSurfaceOptions): ContextMenuSurface {
	registerPptxWebControls();
	const element = options.doc.createElement('pptx-ui-context-menu');
	element.state = options.state;
	element.addEventListener('menu-request', (event) =>
		options.onRequest((event as CustomEvent<{ id: string }>).detail.id),
	);
	element.addEventListener('menu-close', () => options.onClose());
	options.parent.appendChild(element);
	return {
		element,
		close: () => element.remove(),
	};
}
