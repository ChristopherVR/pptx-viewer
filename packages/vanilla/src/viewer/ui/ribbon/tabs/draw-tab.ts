import type { RibbonControlId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import type { DrawTool } from '../../../state';
import { makeButton } from '../../controls';
import { makeDropdown } from '../../dropdown';
import type { IconName } from '../../icons';
import { makeSwatchPicker, OFFICE_STANDARD_SWATCHES } from '../../swatch-picker';
import { tagRibbonControl, tagRibbonGroup } from '../ribbon-tagging';
import type { RibbonDrawHandlers, RibbonDrawState } from '../ribbon-types';

/** Stroke width presets (px) offered by the width dropdown. */
const STROKE_WIDTHS: readonly number[] = [1, 2, 3, 4, 6, 8, 12, 16];

const TOOLS: ReadonlyArray<{
	tool: DrawTool;
	icon: IconName;
	labelKey: string;
	/** Catalogue id; Freeform has none. */
	control?: RibbonControlId;
}> = [
	{
		tool: 'select',
		icon: 'cursor',
		labelKey: 'pptx.ribbon.tool.select',
		control: 'draw.tools.select',
	},
	{ tool: 'pen', icon: 'pen', labelKey: 'pptx.ribbon.tool.pen', control: 'draw.tools.pen' },
	{
		tool: 'highlighter',
		icon: 'highlighter',
		labelKey: 'pptx.ribbon.tool.highlighter',
		control: 'draw.tools.highlighter',
	},
	{
		tool: 'eraser',
		icon: 'eraser',
		labelKey: 'pptx.ribbon.tool.eraser',
		control: 'draw.tools.eraser',
	},
	{ tool: 'freeform', icon: 'pen', labelKey: 'pptx.ribbon.tool.freeform' },
];

export interface DrawTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Reflect the current tool/colour/width (store-driven; see `editor-controller.ts`). */
	update(state: RibbonDrawState): void;
}

/**
 * The Draw ribbon tab: a pen/highlighter/eraser/select tool switcher, a
 * stroke colour swatch picker, and a stroke-width dropdown. Selecting a tool
 * is plain UI state (`RibbonDrawHandlers`, mirroring the Design tab's theme
 * gallery); the actual freehand stroke only becomes an undoable `ink`
 * element once a gesture completes (`editor-draw-gestures.ts` ->
 * `EditActions.commitStroke`, wired in `editor-controller.ts`).
 */
export function createDrawTab(doc: Document, t: Translator, handlers: RibbonDrawHandlers): DrawTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');

	// Both rgroups are PowerPoint's one Drawing Tools group.
	const toolGroup = tagRibbonGroup(createEl(doc, 'div', 'pptxv-rgroup'), 'draw.tools');
	const toolRow = createEl(doc, 'div', 'pptxv-rgroup-row');
	toolGroup.appendChild(toolRow);
	const toolLabel = createEl(doc, 'span', 'pptxv-rgroup-label');
	toolLabel.textContent = t('pptx.ribbon.draw');
	toolGroup.appendChild(toolLabel);

	const toolButtons = TOOLS.map((def) =>
		makeButton(doc, {
			label: t(def.labelKey),
			icon: def.icon,
			onClick: () => handlers.setTool(def.tool),
		}),
	);
	for (const [i, def] of TOOLS.entries()) {
		if (def.control) {
			tagRibbonControl(toolButtons[i].btn, def.control);
		}
	}
	toolRow.append(...toolButtons.map((b) => b.btn));
	el.appendChild(toolGroup);

	const styleGroup = tagRibbonGroup(createEl(doc, 'div', 'pptxv-rgroup'), 'draw.tools');
	const styleRow = createEl(doc, 'div', 'pptxv-rgroup-row');
	styleGroup.appendChild(styleRow);

	const colorPicker = makeSwatchPicker(doc, t, {
		label: t('pptx.ribbon.colour'),
		icon: 'pen',
		swatches: OFFICE_STANDARD_SWATCHES,
		fallback: '#000000',
		onSelect: (hex) => handlers.setColor(hex),
	});
	const widthDropdown = makeDropdown<number>(doc, {
		triggerLabel: t('pptx.ribbon.width'),
		triggerText: '',
		icon: 'chevron-down',
		items: STROKE_WIDTHS.map((w) => ({ label: `${w} px`, value: w })),
		onSelect: (width) => handlers.setWidth(width),
	});
	tagRibbonControl(colorPicker.el, 'draw.tools.penColor');
	tagRibbonControl(widthDropdown.el, 'draw.tools.penWidth');
	styleRow.append(colorPicker.el, widthDropdown.el);
	el.appendChild(styleGroup);

	const gated = [...toolButtons, colorPicker, widthDropdown];

	return {
		el,
		setEditable(editable) {
			for (const c of gated) {
				c.setDisabled(!editable);
			}
		},
		update(state) {
			for (const [i, def] of TOOLS.entries()) {
				toolButtons[i].setActive(state.tool === def.tool);
			}
			colorPicker.setValue(state.color);
			colorPicker.setRecentColors(state.recentColors ?? []);
			widthDropdown.setSelected(state.width);
			widthDropdown.setTriggerText(`${state.width} px`);
		},
	};
}
