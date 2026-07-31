import type { PptxTableCellStyle } from 'pptx-viewer-core';
import { FILL_PATTERN_LABEL_KEYS, schemaLabel } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The nine `a:pattFill` presets this panel offers, matching React's list. Kept
 * as bare tokens because they are written straight onto
 * `patternFillPreset`; the shared map only decides how each one is spelled.
 */
const PATTERN_PRESETS: readonly string[] = [
	'ltDnDiag',
	'dkDnDiag',
	'ltUpDiag',
	'dkUpDiag',
	'smGrid',
	'lgGrid',
	'horz',
	'vert',
	'diagCross',
];

export interface TableCellFillControls {
	el: HTMLElement;
	update(state: InspectorState): void;
}

export function createTableCellFillControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): TableCellFillControls {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-table-cell-fill';
	let state: InspectorState | null = null;
	const apply = (patch: Partial<PptxTableCellStyle>): void => {
		if (state?.selectedTableCell) {
			handlers.setTableCellStyles(
				state.selectedTableCells.length > 0 ? state.selectedTableCells : [state.selectedTableCell],
				patch,
			);
		}
	};
	/**
	 * @param keys optional wire-token to i18n-key map. Passing it spells the
	 *   options out without touching the value list; omitting it keeps the token
	 *   as the caption, which is still readable for word-like values such as
	 *   `solid` or `top`.
	 */
	const select = (
		label: string,
		values: readonly string[],
		keys?: Readonly<Record<string, string>>,
	): HTMLSelectElement => {
		const wrapper = doc.createElement('label');
		wrapper.textContent = label;
		const input = doc.createElement('select');
		for (const value of values) {
			const option = doc.createElement('option');
			option.value = value;
			option.textContent = keys ? schemaLabel(keys, value, t) : value;
			input.appendChild(option);
		}
		wrapper.appendChild(input);
		el.appendChild(wrapper);
		return input;
	};
	const color = (label: string): HTMLInputElement => {
		const wrapper = doc.createElement('label');
		wrapper.textContent = label;
		const input = doc.createElement('input');
		input.type = 'color';
		wrapper.appendChild(input);
		el.appendChild(wrapper);
		return input;
	};
	const fillMode = select(t('pptx.table.fillMode'), ['solid', 'gradient', 'pattern', 'none']);
	const gradientType = select(t('pptx.table.gradientType'), ['linear', 'radial']);
	const gradientAngle = doc.createElement('input');
	gradientAngle.type = 'number';
	gradientAngle.min = '0';
	gradientAngle.max = '360';
	gradientAngle.title = t('pptx.table.gradientAngle');
	el.appendChild(gradientAngle);
	const gradientStart = color(t('pptx.table.gradientStart'));
	const gradientEnd = color(t('pptx.table.gradientEnd'));
	const pattern = select(t('pptx.table.patternPreset'), PATTERN_PRESETS, FILL_PATTERN_LABEL_KEYS);
	const patternForeground = color(t('pptx.table.patternForeground'));
	const patternBackground = color(t('pptx.table.patternBackground'));
	const edge = select(t('pptx.table.cellBorders'), ['top', 'right', 'bottom', 'left']);
	const edgeColor = color(t('pptx.table.borderColor'));
	const edgeWidth = doc.createElement('input');
	edgeWidth.type = 'number';
	edgeWidth.min = '0';
	edgeWidth.max = '20';
	edgeWidth.title = t('pptx.table.borderWidth');
	el.appendChild(edgeWidth);
	const updateGradient = (): void =>
		apply({
			fillMode: 'gradient',
			gradientFillType: gradientType.value as 'linear' | 'radial',
			gradientFillAngle: Number(gradientAngle.value),
			gradientFillStops: [
				{ color: gradientStart.value, position: 0 },
				{ color: gradientEnd.value, position: 100 },
			],
		});
	fillMode.addEventListener('change', () =>
		apply({ fillMode: fillMode.value as PptxTableCellStyle['fillMode'] }),
	);
	for (const input of [gradientType, gradientAngle, gradientStart, gradientEnd]) {
		input.addEventListener('change', updateGradient);
	}
	const updatePattern = (): void =>
		apply({
			fillMode: 'pattern',
			patternFillPreset: pattern.value,
			patternFillForeground: patternForeground.value,
			patternFillBackground: patternBackground.value,
		});
	for (const input of [pattern, patternForeground, patternBackground]) {
		input.addEventListener('change', updatePattern);
	}
	const updateEdge = (): void => {
		const suffix = `${edge.value[0].toUpperCase()}${edge.value.slice(1)}`;
		apply({
			[`border${suffix}Color`]: edgeColor.value,
			[`border${suffix}Width`]: Number(edgeWidth.value),
		});
	};
	for (const input of [edge, edgeColor, edgeWidth]) {
		input.addEventListener('change', updateEdge);
	}
	const all = el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select');

	return {
		el,
		update(next) {
			state = next;
			el.hidden = !next.selectedTableCell;
			const style = next.tableCellStyle ?? {};
			fillMode.value = style.fillMode ?? 'solid';
			gradientType.value = style.gradientFillType ?? 'linear';
			gradientAngle.value = String(style.gradientFillAngle ?? 90);
			gradientStart.value = style.gradientFillStops?.[0]?.color ?? '#ff0000';
			gradientEnd.value = style.gradientFillStops?.at(-1)?.color ?? '#0000ff';
			pattern.value = style.patternFillPreset ?? 'ltDnDiag';
			patternForeground.value = style.patternFillForeground ?? '#000000';
			patternBackground.value = style.patternFillBackground ?? '#ffffff';
			const suffix = `${edge.value[0].toUpperCase()}${edge.value.slice(1)}`;
			edgeColor.value = String(style[`border${suffix}Color` as keyof typeof style] ?? '#374151');
			edgeWidth.value = String(style[`border${suffix}Width` as keyof typeof style] ?? 1);
			for (const input of all) {
				input.disabled = !next.isTable;
			}
		},
	};
}
