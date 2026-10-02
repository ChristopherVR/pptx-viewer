import type { PptxLayoutPreview } from 'pptx-viewer-core';

import { buildLayoutPreviewGeometry, homeLabel, isCurrentLayout } from '../render';
import type { LayoutPreviewGeometry, RibbonHomeLayoutModel, RibbonHomeViewState } from '../render';

/**
 * Draws a layout's real artwork inside a tile's scaled surface. The artwork is
 * element rendering that each binding owns; return a disposer to release it.
 */
export type HomeLayoutArtwork = (
	preview: PptxLayoutPreview,
	geometry: LayoutPreviewGeometry,
	container: HTMLElement,
) => (() => void) | void;

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

function previewOf(model: RibbonHomeLayoutModel, path: string): PptxLayoutPreview | undefined {
	const previews = model.previews;
	return previews instanceof Map
		? previews.get(path)
		: (previews as Record<string, PptxLayoutPreview> | undefined)?.[path];
}

/** Paint the layout gallery; returns a disposer for the artwork drawn by the host. */
export function paintHomeLayouts(
	doc: Document,
	popup: HTMLElement,
	model: RibbonHomeLayoutModel | undefined,
	state: RibbonHomeViewState,
	artwork: HomeLayoutArtwork | undefined,
	pick: (path: string) => void,
): () => void {
	const disposers: Array<() => void> = [];
	popup.dataset.testid = 'layout-gallery-menu';
	const tiles: HTMLElement[] = [];
	if (!model || model.layouts.length === 0) {
		const empty = doc.createElement('p');
		empty.className = 'empty';
		empty.textContent = homeLabel(state, 'pptx.layoutGallery.empty', 'No layouts available');
		tiles.push(empty);
	}
	for (const layout of model?.layouts ?? []) {
		const current = isCurrentLayout(layout, model?.current);
		const preview = model ? previewOf(model, layout.path) : undefined;
		const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);
		const tile = doc.createElement('button');
		tile.type = 'button';
		tile.className = 'tile';
		tile.dataset.layoutPath = layout.path;
		tile.dataset.pptxCompact = '';
		if (current) {
			tile.setAttribute('aria-current', 'true');
		}
		const currentLabel = homeLabel(state, 'pptx.layoutGallery.current', 'Current layout');
		tile.title = current ? `${layout.name} (${currentLabel})` : layout.name;
		const box = doc.createElement('div');
		box.className = 'thumb';
		box.style.width = `${geometry.boxWidth}px`;
		box.style.height = `${geometry.boxHeight}px`;
		box.style.backgroundColor = geometry.backgroundColor;
		const surface = doc.createElement('div');
		surface.className = 'surface';
		surface.style.width = `${geometry.surfaceWidth}px`;
		surface.style.height = `${geometry.surfaceHeight}px`;
		surface.style.transform = `scale(${geometry.scale})`;
		surface.style.backgroundColor = geometry.backgroundColor;
		if (preview && artwork) {
			const dispose = artwork(preview, geometry, surface);
			if (dispose) {
				disposers.push(dispose);
			}
		}
		for (const frame of geometry.frames) {
			const outline = doc.createElement('div');
			outline.className = 'frame';
			outline.style.cssText = `left:${frame.left}px;top:${frame.top}px;width:${frame.width}px;height:${frame.height}px;border-width:${geometry.frameBorderWidth}px`;
			surface.append(outline);
		}
		box.append(surface);
		const name = doc.createElement('span');
		name.className = 'name';
		name.textContent = layout.name;
		tile.append(box, name);
		tile.addEventListener('mousedown', (event) => event.preventDefault());
		tile.addEventListener('click', () => pick(layout.path));
		tiles.push(tile);
	}
	popup.replaceChildren(...tiles);
	return () => {
		for (const dispose of disposers.splice(0)) {
			dispose();
		}
	};
}
