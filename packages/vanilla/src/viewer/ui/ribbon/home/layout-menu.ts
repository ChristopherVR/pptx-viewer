import type { PptxLayoutPreview } from 'pptx-viewer-core';
import { buildLayoutPreviewGeometry, isCurrentLayout } from 'pptx-viewer-shared';
import type { LayoutPreviewGeometry } from 'pptx-viewer-shared';

import { createEl } from '../../../render';
import type { LayoutOption } from '../ribbon-types';

/**
 * Renders one layout's artwork into a detached element.
 *
 * Injected rather than imported so this module keeps to DOM assembly and the
 * host owns the element-renderer registry and theme wiring.
 */
export type LayoutPreviewRenderer = (
	preview: PptxLayoutPreview,
	geometry: LayoutPreviewGeometry,
) => HTMLElement | undefined;

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

/** A layout picker popover: repopulated on every `setItems`, closes on select/outside. */
interface LayoutMenu {
	el: HTMLElement;
	setItems(layouts: readonly LayoutOption[], context: LayoutMenuContext): void;
	toggle(): void;
	close(): void;
}

/** What the tiles need beyond the layout list itself. */
interface LayoutMenuContext {
	previews: ReadonlyMap<string, PptxLayoutPreview>;
	/** Marks the active tile. Omitted by New Slide, which has no "current". */
	currentLayoutPath?: string;
	/** Renders one layout's artwork; supplied by the host so this file stays DOM-only. */
	renderPreview?: LayoutPreviewRenderer;
}

export function createLayoutMenu(
	doc: Document,
	ariaLabel: string,
	onPick: (layout: LayoutOption) => void,
	onOpenChange?: (open: boolean) => void,
): LayoutMenu {
	const el = createEl(doc, 'div', 'pptxv-primary-menu pptxv-layout-menu');
	// Shared cross-binding hook the framework-neutral e2e specs select on.
	el.dataset.testid = 'layout-gallery-menu';
	el.setAttribute('role', 'menu');
	el.setAttribute('aria-label', ariaLabel);
	el.hidden = true;

	let open = false;
	const setOpen = (next: boolean): void => {
		open = next;
		el.hidden = !next;
		onOpenChange?.(next);
	};

	doc.addEventListener('pointerdown', (event) => {
		if (open && !el.parentElement?.contains(event.target as Node)) {
			setOpen(false);
		}
	});

	/**
	 * What the gallery currently shows. Each tile RENDERS a layout preview, and
	 * the whole menu was rebuilt on every state sync - including while a slide
	 * show is running and the ribbon is hidden. Skipping an unchanged gallery is
	 * what keeps a slide advance from repainting the layouts it cannot see.
	 */
	let renderedSignature: string | null = null;

	return {
		el,
		setItems(layouts, context) {
			const signature = JSON.stringify([
				layouts.map((layout) => [layout.path, layout.name]),
				context.currentLayoutPath ?? '',
				// A preview arriving later must repaint its tile.
				layouts.map((layout) => (context.previews.get(layout.path) ? 1 : 0)),
			]);
			if (signature === renderedSignature) {
				return;
			}
			renderedSignature = signature;
			el.replaceChildren();
			for (const layout of layouts) {
				const btn = createEl(doc, 'button', 'pptxv-layout-tile');
				btn.type = 'button';
				btn.setAttribute('role', 'menuitem');
				if (isCurrentLayout(layout, context.currentLayoutPath)) {
					btn.classList.add('pptxv-layout-tile-current');
					btn.setAttribute('aria-current', 'true');
				}
				btn.appendChild(
					buildLayoutThumbnail(doc, context.previews.get(layout.path), context.renderPreview),
				);
				const name = createEl(doc, 'span', 'pptxv-layout-tile-name');
				name.textContent = layout.name;
				btn.appendChild(name);
				btn.title = layout.name;
				btn.addEventListener('click', () => {
					setOpen(false);
					onPick(layout);
				});
				el.appendChild(btn);
			}
		},
		toggle: () => setOpen(!open),
		close: () => setOpen(false),
	};
}

/**
 * Build one thumbnail: the layout's artwork drawn at slide scale, with the
 * placeholder frames outlined on top.
 *
 * The artwork is rendered full size on an inner surface and the whole surface
 * is scaled, so element positions need no conversion. The shared geometry
 * helper decides the scale and pre-divides the outline width so it does not
 * shrink to an invisible hairline.
 */
function buildLayoutThumbnail(
	doc: Document,
	preview: PptxLayoutPreview | undefined,
	renderPreview: LayoutPreviewRenderer | undefined,
): HTMLElement {
	const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);

	const box = createEl(doc, 'div', 'pptxv-layout-tile-thumb');
	box.style.width = `${geometry.boxWidth}px`;
	box.style.height = `${geometry.boxHeight}px`;
	box.style.backgroundColor = geometry.backgroundColor;

	const surface = createEl(doc, 'div', 'pptxv-layout-tile-surface');
	surface.style.width = `${geometry.surfaceWidth}px`;
	surface.style.height = `${geometry.surfaceHeight}px`;
	surface.style.transform = `scale(${geometry.scale})`;

	const artwork = preview && renderPreview ? renderPreview(preview, geometry) : undefined;
	if (artwork) {
		surface.appendChild(artwork);
	}

	for (const frame of geometry.frames) {
		const outline = createEl(doc, 'div', 'pptxv-layout-tile-frame');
		outline.style.left = `${frame.left}px`;
		outline.style.top = `${frame.top}px`;
		outline.style.width = `${frame.width}px`;
		outline.style.height = `${frame.height}px`;
		outline.style.borderWidth = `${geometry.frameBorderWidth}px`;
		surface.appendChild(outline);
	}

	box.appendChild(surface);
	return box;
}
