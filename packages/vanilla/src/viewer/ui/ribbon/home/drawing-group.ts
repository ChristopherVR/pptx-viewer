import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { RibbonGalleryId, ShapePresetType } from 'pptx-viewer-shared';
import { drawingHomeControls, homeGalleryControls, withHomeGalleries } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { RibbonGalleryHub } from '../gallery/gallery-hub';
import { createRibbonGalleryHub } from '../gallery/gallery-hub';
import { tagRibbonGroup } from '../ribbon-tagging';
import { createSharedHomeStrip } from './shared-strip';

export interface DrawingGroupHandlers {
	insertShape(shapeType: ShapePresetType): void;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	/** Same `ref` contract as the swatch commit: omit for a plain/custom/recent pick. */
	setShapeFill(color: string, ref?: PptxThemeColorRef): void;
	setShapeStroke(color: string, ref?: PptxThemeColorRef): void;
}

export interface DrawingGroupState {
	editable: boolean;
	hasSelection: boolean;
	/** The deck's `p:clrMru`, most-recent-first. */
	recentColors?: readonly string[];
	/** The deck's resolved theme colour map, feeding the fill/outline "Theme Colors" grids. */
	themeColorMap?: Record<string, string>;
	/** The selected shape's current fill, highlighting the matching theme/standard swatch. */
	fillColor?: string;
	fillColorRef?: PptxThemeColorRef;
	/** The selected shape's current stroke, highlighting the matching theme/standard swatch. */
	strokeColor?: string;
	strokeColorRef?: PptxThemeColorRef;
}

export interface DrawingGroup {
	el: HTMLElement;
	update(state: DrawingGroupState): void;
}

const GALLERY_BY_CONTROL: Record<string, RibbonGalleryId> = {
	'home.drawing.quickStyles': 'shapeStyles',
	'home.drawing.shapeEffects': 'shapeEffects',
};

/**
 * The Home tab's Drawing group: the shared strip renders the Shapes and Arrange
 * menus, the Fill and Outline colour popovers and the Quick Styles / Shape
 * Effects galleries. Picks route to the native editing handlers.
 */
export function createDrawingGroup(
	doc: Document,
	t: Translator,
	handlers: DrawingGroupHandlers,
	galleryHub: RibbonGalleryHub = createRibbonGalleryHub(() => {}),
): DrawingGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	el.dataset.pptxChrome = 'home-group';
	tagRibbonGroup(el, 'home.drawing');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	row.dataset.pptxChrome = 'drawing-controls';
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.dataset.pptxChrome = 'ribbon-group-label';
	label.textContent = t('pptx.ribbon.groupDrawing');
	el.append(row, label);

	const arrange: Record<string, () => void> = {
		forward: handlers.bringForward,
		backward: handlers.sendBackward,
		front: handlers.bringToFront,
		back: handlers.sendToBack,
	};
	const strip = createSharedHomeStrip(doc, t, 'drawing', ({ id, value, ref }) => {
		if (value === undefined) {
			return;
		}
		if (GALLERY_BY_CONTROL[id]) {
			galleryHub.pick(GALLERY_BY_CONTROL[id], String(value));
		} else if (id === 'home.drawing.shapes') {
			handlers.insertShape(value as ShapePresetType);
		} else if (id === 'home.drawing.arrange') {
			arrange[String(value)]?.();
		} else if (id === 'home.drawing.shapeFill') {
			handlers.setShapeFill(String(value), ref);
		} else if (id === 'home.drawing.shapeOutline') {
			handlers.setShapeStroke(String(value), ref);
		}
	});
	row.append(strip.el);

	let last: DrawingGroupState = { editable: false, hasSelection: false };
	const render = () => {
		const colour = (value: string | undefined, ref: PptxThemeColorRef | undefined) => ({
			value: value ?? '#ffffff',
			ref,
			themeColors: last.themeColorMap,
			recent: last.recentColors,
		});
		strip.set(
			withHomeGalleries(
				drawingHomeControls({
					editable: last.editable,
					hasSelection: last.hasSelection,
					fill: colour(last.fillColor, last.fillColorRef),
					outline: colour(last.strokeColor ?? '#000000', last.strokeColorRef),
				}),
				homeGalleryControls('drawing', galleryHub.context(), last.editable),
				last.editable,
			),
		);
	};
	galleryHub.register({ refresh: render, close: () => {} });

	return {
		el,
		update(state) {
			last = state;
			render();
		},
	};
}
