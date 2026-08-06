import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonInsertHandlers } from '../ribbon-types';
import { createActionButtonDropdown } from './insert/action-button-group';
import { createChartControl } from './insert/chart-group';
import { createFieldDropdown } from './insert/field-group';
import { createHyperlinkButton } from './insert/hyperlink-button';
import { createShapeControl } from './insert/shape-group';
import { createSmartArtControl } from './insert/smartart-group';

export interface InsertTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
	/** Gate the selection-scoped commands (Link attaches to a selected element). */
	setHasSelection(hasSelection: boolean): void;
}

/**
 * The Insert ribbon tab: text box, shape, image, media, table, chart,
 * SmartArt, equation, action button, field, hyperlink and Header & Footer, in
 * React's order. Every insertion routes through `RibbonInsertHandlers` (backed
 * by `EditActions`, so it's undoable and selects the new element), except
 * Equation, which opens the modal equation editor dialog (`equation-panel.ts`;
 * LaTeX has no single-click default, unlike every other insert kind here),
 * Hyperlink, which opens the link editor for the current selection, and
 * Header & Footer, which opens the viewer's own dialog.
 */
export function createInsertTab(
	doc: Document,
	t: Translator,
	handlers: RibbonInsertHandlers,
	onToggleEquationPanel: () => void,
	onOpenHeaderFooter: () => void,
	onOpenHyperlink: () => void,
): InsertTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	el.classList.add('pptxv-ribbon-insert-content');

	const textBox = makeButton(doc, {
		label: t('pptx.ribbon.textBox'),
		icon: 'text-box',
		onClick: () => handlers.insert('text'),
	});
	const shape = createShapeControl(doc, t, (shapeType) => handlers.insert('shape', shapeType));
	const image = makeButton(doc, {
		label: t('pptx.ribbon.image'),
		icon: 'image',
		onClick: () => void handlers.insertImage(),
	});
	const media = makeButton(doc, {
		label: t('pptx.ribbon.media'),
		icon: 'video',
		onClick: () => void handlers.insertMedia(),
	});
	media.btn.title = t('pptx.ribbon.insertMedia');
	const table = makeButton(doc, {
		label: t('pptx.ribbon.table'),
		icon: 'table',
		onClick: () => handlers.insert('table'),
	});
	const chart = createChartControl(doc, t, (chartKind) => handlers.insertChart(chartKind));
	const smartArt = createSmartArtControl(doc, t, (layout, defaultItems) =>
		handlers.insertSmartArt(layout, defaultItems),
	);
	const equation = makeButton(doc, {
		label: t('pptx.ribbon.equation'),
		icon: 'equation',
		onClick: onToggleEquationPanel,
	});
	equation.btn.title = t('pptx.insert.insertEquation');
	const actionButtonDropdown = createActionButtonDropdown(doc, t, (shapeType) =>
		handlers.insertActionButton(shapeType),
	);
	const fieldDropdown = createFieldDropdown(doc, t, (fieldType) => handlers.insertField(fieldType));
	const hyperlink = createHyperlinkButton(doc, t, onOpenHyperlink);
	const headerFooter = makeButton(doc, {
		label: t('pptx.headerFooter.title'),
		icon: 'field',
		textLabel: t('pptx.headerFooter.title'),
		onClick: onOpenHeaderFooter,
	});

	el.append(
		textBox.btn,
		shape.el,
		image.btn,
		media.btn,
		table.btn,
		chart.el,
		smartArt.el,
		equation.btn,
		actionButtonDropdown.el,
		fieldDropdown.el,
		hyperlink.btn,
		headerFooter.btn,
	);

	const gated: Array<{ setDisabled(disabled: boolean): void }> = [
		textBox,
		shape,
		image,
		media,
		table,
		chart,
		smartArt,
		equation,
		actionButtonDropdown,
		fieldDropdown,
		headerFooter,
	];

	return {
		el,
		setEditable(editable) {
			// Hyperlink is deliberately absent from `gated`: it tracks the
			// selection, not editability, so an editable deck with nothing
			// selected must still leave it unavailable.
			for (const control of gated) {
				control.setDisabled(!editable);
			}
		},
		setHasSelection(hasSelection) {
			hyperlink.setDisabled(!hasSelection);
		},
	};
}
