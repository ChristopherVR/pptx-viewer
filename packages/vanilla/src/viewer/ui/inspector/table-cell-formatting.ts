import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { schemaLabel } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * Captions for the cell alignment pickers.
 *
 * The values are `a:tc` wire tokens, so they stay verbatim; the keys are the
 * ones the sibling `text-section.ts` already uses for the same three choices,
 * which keeps one wording for "Middle" across the inspector rather than letting
 * the table panel print the raw token.
 */
const ALIGN_LABEL_KEYS: Readonly<Record<string, string>> = {
	left: 'pptx.textPanel.alignLeft',
	center: 'pptx.textPanel.alignCenter',
	right: 'pptx.textPanel.alignRight',
};

const VALIGN_LABEL_KEYS: Readonly<Record<string, string>> = {
	top: 'pptx.textPanel.valignTop',
	middle: 'pptx.textPanel.valignMiddle',
	bottom: 'pptx.textPanel.valignBottom',
};

export interface TableCellFormatting {
	el: HTMLElement;
	update(state: InspectorState): void;
}

function validColor(value: string | undefined, fallback: string): string {
	return /^#[0-9a-f]{6}$/i.test(value ?? '') ? (value as string) : fallback;
}

export function createTableCellFormatting(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): TableCellFormatting {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-table-cell';
	const heading = doc.createElement('strong');
	el.appendChild(heading);
	let selected: { row: number; column: number } | null = null;
	let selectedCells: Array<{ row: number; column: number }> = [];
	const apply = (patch: Partial<PptxTableCellStyle>): void => {
		if (selected) {
			handlers.setTableCellStyles(selectedCells.length > 0 ? selectedCells : [selected], patch);
		}
	};
	// The control is named explicitly: a wrapping `<label>` lends its whole text
	// content, which for a `<select>` includes every option.
	const field = (labelText: string, input: HTMLInputElement | HTMLSelectElement): HTMLElement => {
		const label = doc.createElement('label');
		const text = doc.createElement('span');
		text.textContent = labelText;
		input.setAttribute('aria-label', labelText);
		label.append(text, input);
		el.appendChild(label);
		return label;
	};
	const number = (label: string, onChange: (value: number) => void): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'number';
		input.addEventListener('change', () => onChange(Number(input.value)));
		field(label, input);
		return input;
	};
	const color = (label: string, key: keyof PptxTableCellStyle): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'color';
		input.addEventListener('input', () => apply({ [key]: input.value }));
		// B6: push into the "Recent colours" MRU list once the picker commits.
		input.addEventListener('change', () => handlers.pushRecentColor(input.value));
		field(label, input);
		return input;
	};
	const toggle = (label: string, key: 'bold' | 'italic' | 'underline'): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'checkbox';
		input.addEventListener('change', () => apply({ [key]: input.checked }));
		field(label, input);
		return input;
	};
	const select = <T extends string>(
		label: string,
		values: readonly T[],
		keys: Readonly<Record<string, string>>,
		onChange: (value: T) => void,
	): HTMLSelectElement => {
		const input = doc.createElement('select');
		for (const value of values) {
			const option = doc.createElement('option');
			option.value = value;
			option.textContent = schemaLabel(keys, value, t);
			input.appendChild(option);
		}
		input.addEventListener('change', () => onChange(input.value as T));
		field(label, input);
		return input;
	};

	const fontSize = number(t('pptx.table.fontSize'), (value) => apply({ fontSize: value }));
	const textColor = color(t('pptx.table.color'), 'color');
	const background = color(t('pptx.table.background'), 'backgroundColor');
	const borderColor = color(t('pptx.table.cellBorders'), 'borderColor');
	const borderWidth = number(t('pptx.table.borderWidth'), (value) =>
		apply({
			borderTopWidth: value,
			borderRightWidth: value,
			borderBottomWidth: value,
			borderLeftWidth: value,
		}),
	);
	const margin = number(t('pptx.table.cellPadding'), (value) =>
		apply({ marginLeft: value, marginRight: value, marginTop: value, marginBottom: value }),
	);
	const bold = toggle(t('pptx.format.bold'), 'bold');
	const italic = toggle(t('pptx.format.italic'), 'italic');
	const underline = toggle(t('pptx.format.underline'), 'underline');
	const align = select(
		t('pptx.table.alignment'),
		['left', 'center', 'right'] as const,
		ALIGN_LABEL_KEYS,
		(value) => apply({ align: value }),
	);
	const vAlign = select(
		t('pptx.table.verticalAlignment'),
		['top', 'middle', 'bottom'] as const,
		VALIGN_LABEL_KEYS,
		(value) => apply({ vAlign: value }),
	);
	const inputs = [
		fontSize,
		textColor,
		background,
		borderColor,
		borderWidth,
		margin,
		bold,
		italic,
		underline,
		align,
		vAlign,
	];

	return {
		el,
		update(state) {
			selected = state.selectedTableCell;
			selectedCells = state.selectedTableCells;
			el.hidden = !selected;
			if (!selected) {
				return;
			}
			heading.textContent = t('pptx.table.cell', {
				row: selected.row + 1,
				col: selected.column + 1,
			});
			const style = state.tableCellStyle ?? {};
			fontSize.value = String(style.fontSize ?? 14);
			textColor.value = validColor(style.color, '#000000');
			background.value = validColor(style.backgroundColor, '#ffffff');
			borderColor.value = validColor(style.borderColor, '#374151');
			borderWidth.value = String(style.borderTopWidth ?? 1);
			margin.value = String(style.marginLeft ?? 4);
			bold.checked = Boolean(style.bold);
			italic.checked = Boolean(style.italic);
			underline.checked = Boolean(style.underline);
			align.value = style.align ?? 'left';
			vAlign.value = style.vAlign ?? 'top';
			for (const input of inputs) {
				input.disabled = !state.isTable;
			}
		},
	};
}
