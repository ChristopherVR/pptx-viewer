import type { PptxThemeColorRef } from 'pptx-viewer-core';
import type { ShapePresetType } from 'pptx-viewer-shared';
import { RIBBON_SHAPE_SWATCHES, SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import { makeSwatchPicker } from '../../swatch-picker';

export interface DrawingGroupHandlers {
	insertShape(shapeType: ShapePresetType): void;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	groupSelected(): void;
	ungroupSelected(): void;
	/** Same `ref` contract as `SwatchPickerOptions.onSelectTheme`: omit for a plain/custom/recent pick. */
	setShapeFill(color: string, ref?: PptxThemeColorRef): void;
	setShapeStroke(color: string, ref?: PptxThemeColorRef): void;
}

export interface DrawingGroupState {
	editable: boolean;
	hasSelection: boolean;
	/** B6: the deck's `p:clrMru`, most-recent-first; seeds/refreshes both pickers' rows. */
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

/** How many of the shape catalogue's presets the Shapes menu offers (React parity). */
const TOP_SHAPE_COUNT = 12;

/**
 * The ribbon Home tab's Drawing group, mirroring React's `DrawingGroup`: a
 * Shapes menu, an Arrange menu, Shape Fill / Shape Outline swatch pickers and
 * the not-yet-implemented Shape Effects placeholder.
 *
 * Group/Ungroup ride in the Arrange menu rather than as their own ribbon
 * buttons: React offers no such buttons, and a menu entry keeps this binding's
 * grouping feature reachable without inventing a control the other bindings
 * do not have.
 */
export function createDrawingGroup(
	doc: Document,
	t: Translator,
	handlers: DrawingGroupHandlers,
): DrawingGroup {
	const el = createEl(doc, 'div', 'pptxv-rgroup');
	const row = createEl(doc, 'div', 'pptxv-rgroup-row');
	el.appendChild(row);
	const label = createEl(doc, 'span', 'pptxv-rgroup-label');
	label.textContent = t('pptx.ribbon.groupDrawing');
	el.appendChild(label);

	const shapes = makeDropdown<ShapePresetType>(doc, {
		triggerLabel: t('pptx.drawing.shapes'),
		triggerText: t('pptx.drawing.shapes'),
		icon: 'shapes',
		items: SHAPE_PRESET_DEFS.slice(0, TOP_SHAPE_COUNT).map((preset) => ({
			label: t(preset.i18nKey),
			value: preset.type,
		})),
		onSelect: (shapeType) => handlers.insertShape(shapeType),
	});

	/** Arrange-menu entries are actions, so the dropdown's value *is* the action. */
	const arrange = makeDropdown<() => void>(doc, {
		triggerLabel: t('pptx.ribbon.arrange'),
		triggerText: t('pptx.ribbon.arrange'),
		icon: 'bring-front',
		items: [
			{ label: t('pptx.contextMenu.bringForward'), value: handlers.bringForward },
			{ label: t('pptx.contextMenu.sendBackward'), value: handlers.sendBackward },
			{ label: t('pptx.contextMenu.bringToFront'), value: handlers.bringToFront },
			{ label: t('pptx.contextMenu.sendToBack'), value: handlers.sendToBack },
			{ label: t('pptx.ribbon.group'), value: handlers.groupSelected },
			{ label: t('pptx.ribbon.ungroup'), value: handlers.ungroupSelected },
		],
		onSelect: (run) => run(),
	});

	// W3-G2 follow-up: the deck's real "Theme Colors" grid sits above the flat
	// standard swatches. A theme-swatch click commits BOTH the resolved hex and
	// the ref (so the fill/outline keeps following the theme after a later
	// theme change); a standard or recent swatch click always clears it.
	const fill = makeSwatchPicker(doc, t, {
		label: t('pptx.drawing.shapeFill'),
		icon: 'square',
		swatches: RIBBON_SHAPE_SWATCHES,
		fallback: '#ffffff',
		onSelect: (hex) => handlers.setShapeFill(hex),
		onSelectTheme: (commit) => handlers.setShapeFill(commit.hex, commit.ref),
	});
	const outline = makeSwatchPicker(doc, t, {
		label: t('pptx.drawing.shapeOutline'),
		icon: 'pen',
		swatches: RIBBON_SHAPE_SWATCHES,
		fallback: '#000000',
		onSelect: (hex) => handlers.setShapeStroke(hex),
		onSelectTheme: (commit) => handlers.setShapeStroke(commit.hex, commit.ref),
	});

	// Shape Effects has no implementation in any binding yet; React ships it
	// permanently disabled with a "(not available)" label, so this one does too
	// rather than pretending the feature exists.
	const effects = makeButton(doc, {
		label: t('pptx.drawing.shapeEffectsUnavailable'),
		icon: 'sparkles',
		onClick: () => {},
	});
	effects.setDisabled(true);

	row.append(shapes.el, arrange.el, fill.el, outline.el, effects.btn);

	return {
		el,
		update({
			editable,
			hasSelection,
			recentColors,
			themeColorMap,
			fillColor,
			fillColorRef,
			strokeColor,
			strokeColorRef,
		}) {
			shapes.setDisabled(!editable);
			const canMut = editable && hasSelection;
			arrange.setDisabled(!canMut);
			fill.setDisabled(!canMut);
			outline.setDisabled(!canMut);
			fill.setRecentColors(recentColors ?? []);
			outline.setRecentColors(recentColors ?? []);
			fill.setThemeColorMap(themeColorMap);
			outline.setThemeColorMap(themeColorMap);
			fill.setSelectedRef(fillColorRef);
			outline.setSelectedRef(strokeColorRef);
			if (fillColor !== undefined) {
				fill.setValue(fillColor);
			}
			if (strokeColor !== undefined) {
				outline.setValue(strokeColor);
			}
			effects.setDisabled(true);
		},
	};
}
