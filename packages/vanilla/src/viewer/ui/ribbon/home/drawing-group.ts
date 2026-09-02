import type { ShapePresetType } from 'pptx-viewer-shared';
import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import { makeSwatchPicker, OFFICE_STANDARD_SWATCHES } from '../../swatch-picker';

export interface DrawingGroupHandlers {
	insertShape(shapeType: ShapePresetType): void;
	bringForward(): void;
	sendBackward(): void;
	bringToFront(): void;
	sendToBack(): void;
	groupSelected(): void;
	ungroupSelected(): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
}

export interface DrawingGroupState {
	editable: boolean;
	hasSelection: boolean;
	/** B6: the deck's `p:clrMru`, most-recent-first; seeds/refreshes both pickers' rows. */
	recentColors?: readonly string[];
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

	const fill = makeSwatchPicker(doc, t, {
		label: t('pptx.drawing.shapeFill'),
		icon: 'square',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#ffffff',
		onSelect: (hex) => handlers.setShapeFill(hex),
	});
	const outline = makeSwatchPicker(doc, t, {
		label: t('pptx.drawing.shapeOutline'),
		icon: 'pen',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#000000',
		onSelect: (hex) => handlers.setShapeStroke(hex),
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
		update({ editable, hasSelection, recentColors }) {
			shapes.setDisabled(!editable);
			const canMut = editable && hasSelection;
			arrange.setDisabled(!canMut);
			fill.setDisabled(!canMut);
			outline.setDisabled(!canMut);
			fill.setRecentColors(recentColors ?? []);
			outline.setRecentColors(recentColors ?? []);
			effects.setDisabled(true);
		},
	};
}
