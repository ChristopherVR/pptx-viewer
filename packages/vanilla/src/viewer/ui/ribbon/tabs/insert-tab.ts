import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { IconName } from '../../icons';
import type { RibbonInsertHandlers } from '../ribbon-types';
import { createActionButtonDropdown } from './insert/action-button-group';
import { createChartDropdown } from './insert/chart-group';
import { createFieldDropdown } from './insert/field-group';
import { createSmartArtControl } from './insert/smartart-group';

/** Map a shape-preset-catalog glyph name onto this binding's icon set. */
const GLYPH_TO_ICON: Record<string, IconName> = {
	square: 'square',
	circle: 'circle',
	database: 'database',
	diamond: 'diamond',
	minus: 'minus',
	moveRight: 'move-right',
	plus: 'plus',
	triangle: 'triangle',
};

/**
 * The catalogue's `glyphClass` is a Tailwind utility token (e.g. `rotate-180`,
 * `-skew-x-12`), meaningless outside a Tailwind build. This binding has no
 * Tailwind, so translate the small set of tokens the catalogue actually uses
 * into an inline CSS `transform` instead (real visual differentiation for the
 * arrow/triangle/parallelogram variants that share a base glyph).
 */
function glyphClassToTransform(glyphClass: string): string | undefined {
	switch (glyphClass) {
		case 'rotate-45':
			return 'rotate(45deg)';
		case 'rotate-90':
			return 'rotate(90deg)';
		case '-rotate-90':
			return 'rotate(-90deg)';
		case 'rotate-180':
			return 'rotate(180deg)';
		case '-skew-x-12':
			return 'skewX(-12deg)';
		default:
			return undefined;
	}
}

export interface InsertTab {
	el: HTMLElement;
	setEditable(editable: boolean): void;
}

/**
 * The Insert ribbon tab: text box, table, image, media, chart, equation,
 * SmartArt, action button, field, and the full shape picker grid. Every
 * insertion routes through `RibbonInsertHandlers` (backed by `EditActions`,
 * so it's undoable and selects the new element), except Equation, which opens
 * the modal equation editor dialog (`equation-panel.ts`; LaTeX has no
 * single-click default, unlike every other insert kind here).
 */
export function createInsertTab(
	doc: Document,
	t: Translator,
	handlers: RibbonInsertHandlers,
	onToggleEquationPanel: () => void,
): InsertTab {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	el.classList.add('pptxv-ribbon-insert-content');

	const buttons: Array<{ setDisabled(disabled: boolean): void }> = [];

	const textBox = makeButton(doc, {
		label: t('pptx.ribbon.textBox'),
		icon: 'text-box',
		onClick: () => handlers.insert('text'),
	});
	const table = makeButton(doc, {
		label: t('pptx.ribbon.table'),
		icon: 'table',
		onClick: () => handlers.insert('table'),
	});
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
	const chartDropdown = createChartDropdown(doc, t, (chartType) => handlers.insertChart(chartType));
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

	el.append(
		textBox.btn,
		table.btn,
		image.btn,
		media.btn,
		chartDropdown.el,
		smartArt.el,
		equation.btn,
		actionButtonDropdown.el,
		fieldDropdown.el,
	);
	buttons.push(
		textBox,
		table,
		image,
		media,
		chartDropdown,
		smartArt,
		equation,
		actionButtonDropdown,
		fieldDropdown,
	);

	const shapeGrid = createEl(doc, 'div', 'pptxv-shape-grid');
	el.appendChild(shapeGrid);
	for (const preset of SHAPE_PRESET_DEFS) {
		const btn = makeButton(doc, {
			label: t(preset.i18nKey),
			icon: GLYPH_TO_ICON[preset.glyph] ?? 'square',
			onClick: () => handlers.insert('shape', preset.type),
		});
		const transform = preset.glyphClass ? glyphClassToTransform(preset.glyphClass) : undefined;
		if (transform) {
			const svg = btn.btn.querySelector('svg');
			if (svg) {
				svg.style.transform = transform;
			}
		}
		shapeGrid.appendChild(btn.btn);
		buttons.push(btn);
	}

	return {
		el,
		setEditable(editable) {
			for (const b of buttons) {
				b.setDisabled(!editable);
			}
		},
	};
}
