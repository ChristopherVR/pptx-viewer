import type {
	TableStyleBorderSide,
	TableStyleEditorDescriptor,
	TableStyleEditorFieldEdit,
} from 'pptx-viewer-shared';
import {
	TABLE_STYLE_BORDER_SIDE_LABEL_KEYS,
	TABLE_STYLE_BORDER_SIDES,
	TABLE_STYLE_DASH_PRESETS,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createThemeColorSwatchGrid } from './theme-color-swatch-grid';

export interface TableStyleEditorFieldsHandle {
	el: HTMLElement;
	update(
		descriptor: TableStyleEditorDescriptor,
		themeColorMap: Record<string, string> | undefined,
		canEdit: boolean,
	): void;
}

interface BorderRowHandles {
	color: HTMLInputElement;
	width: HTMLInputElement;
	dash: HTMLSelectElement;
	noFill: HTMLInputElement;
}

/**
 * Field editors (fill/text/borders) for whichever part
 * `table-style-editor.ts`'s shell currently has selected. Mirrors React's
 * `TableStyleEditorFields.tsx` / Vue's `TableStyleEditorFields.vue` / Svelte's
 * `TableStyleEditorFields.svelte`.
 */
export function createTableStyleEditorFields(
	doc: Document,
	t: Translator,
	onEdit: (edit: TableStyleEditorFieldEdit) => void,
): TableStyleEditorFieldsHandle {
	const el = createEl(doc, 'div', 'pptxv-tsef');

	// ---- Fill --------------------------------------------------------------
	const fillGroup = createEl(doc, 'div', 'pptxv-tsef-group');
	const fillHeading = createEl(doc, 'span', 'pptxv-tsef-hdg');
	fillHeading.textContent = t('pptx.tableStyleEditor.fillSection');
	const fillColor = doc.createElement('input');
	fillColor.type = 'color';
	fillColor.addEventListener('input', () =>
		onEdit({ kind: 'fillColor', hex: fillColor.value, ref: undefined }),
	);
	const fillNoFillLabel = createEl(doc, 'label', 'pptxv-tsef-check');
	const fillNoFill = doc.createElement('input');
	fillNoFill.type = 'checkbox';
	fillNoFill.addEventListener('change', () =>
		onEdit({ kind: 'fillNone', noFill: fillNoFill.checked }),
	);
	fillNoFillLabel.append(fillNoFill, doc.createTextNode(t('pptx.tableStyleEditor.noFill')));
	const fillTheme = createThemeColorSwatchGrid(doc, t, (commit) =>
		onEdit({ kind: 'fillColor', hex: commit.hex, ref: commit.ref }),
	);
	fillGroup.append(fillHeading, fillColor, fillNoFillLabel, fillTheme.el);

	// ---- Text ----------------------------------------------------------------
	const textGroup = createEl(doc, 'div', 'pptxv-tsef-group');
	const textHeading = createEl(doc, 'span', 'pptxv-tsef-hdg');
	textHeading.textContent = t('pptx.tableStyleEditor.textSection');
	const boldBtn = makeToggleButton(doc, t('pptx.format.bold'), () =>
		onEdit({ kind: 'textBold', value: !boldBtn.classList.contains('active') }),
	);
	const italicBtn = makeToggleButton(doc, t('pptx.format.italic'), () =>
		onEdit({ kind: 'textItalic', value: !italicBtn.classList.contains('active') }),
	);
	const underlineBtn = makeToggleButton(doc, t('pptx.format.underline'), () =>
		onEdit({ kind: 'textUnderline', value: !underlineBtn.classList.contains('active') }),
	);
	const textColor = doc.createElement('input');
	textColor.type = 'color';
	textColor.addEventListener('input', () =>
		onEdit({ kind: 'textColor', hex: textColor.value, ref: undefined }),
	);
	const textTheme = createThemeColorSwatchGrid(doc, t, (commit) =>
		onEdit({ kind: 'textColor', hex: commit.hex, ref: commit.ref }),
	);
	textGroup.append(textHeading, boldBtn, italicBtn, underlineBtn, textColor, textTheme.el);

	// ---- Borders ---------------------------------------------------------------
	const bordersGroup = createEl(doc, 'div', 'pptxv-tsef-group');
	const bordersHeading = createEl(doc, 'span', 'pptxv-tsef-hdg');
	bordersHeading.textContent = t('pptx.tableStyleEditor.bordersSection');
	const borderRows = new Map<TableStyleBorderSide, BorderRowHandles>();
	for (const side of TABLE_STYLE_BORDER_SIDES) {
		const row = createEl(doc, 'div', 'pptxv-tsef-border-row');
		const label = createEl(doc, 'span', 'pptxv-tsef-side-lbl');
		label.textContent = t(TABLE_STYLE_BORDER_SIDE_LABEL_KEYS[side]);
		const color = doc.createElement('input');
		color.type = 'color';
		color.addEventListener('input', () =>
			onEdit({ kind: 'borderColor', side, hex: color.value, ref: undefined }),
		);
		const width = doc.createElement('input');
		width.type = 'number';
		width.min = '0';
		width.max = '20';
		width.addEventListener('change', () =>
			onEdit({ kind: 'borderWidth', side, width: Number(width.value) }),
		);
		const dash = doc.createElement('select');
		for (const preset of TABLE_STYLE_DASH_PRESETS) {
			const option = doc.createElement('option');
			option.value = preset;
			option.textContent = preset;
			dash.appendChild(option);
		}
		dash.addEventListener('change', () => onEdit({ kind: 'borderDash', side, dash: dash.value }));
		const noFillLabel = createEl(doc, 'label', 'pptxv-tsef-check');
		const noFill = doc.createElement('input');
		noFill.type = 'checkbox';
		noFill.addEventListener('change', () =>
			onEdit({ kind: 'borderNone', side, noFill: noFill.checked }),
		);
		noFillLabel.append(noFill, doc.createTextNode(t('pptx.tableStyleEditor.noBorder')));
		row.append(label, color, width, dash, noFillLabel);
		bordersGroup.appendChild(row);
		borderRows.set(side, { color, width, dash, noFill });
	}

	el.append(fillGroup, textGroup, bordersGroup);

	return {
		el,
		update(descriptor, themeColorMap, canEdit) {
			fillColor.value = descriptor.fill.color.hex;
			fillColor.disabled = !canEdit;
			fillNoFill.checked = descriptor.fill.noFill;
			fillNoFill.disabled = !canEdit;
			fillTheme.setThemeColorMap(themeColorMap);
			fillTheme.setSelected(descriptor.fill.color.ref, descriptor.fill.color.hex);
			fillTheme.setDisabled(!canEdit);

			textGroup.hidden = !descriptor.hasTextAndBorders;
			bordersGroup.hidden = !descriptor.hasTextAndBorders;
			if (!descriptor.hasTextAndBorders) {
				return;
			}
			boldBtn.classList.toggle('active', descriptor.text.bold);
			italicBtn.classList.toggle('active', descriptor.text.italic);
			underlineBtn.classList.toggle('active', descriptor.text.underline);
			for (const btn of [boldBtn, italicBtn, underlineBtn]) {
				btn.disabled = !canEdit;
			}
			textColor.value = descriptor.text.color.hex;
			textColor.disabled = !canEdit;
			textTheme.setThemeColorMap(themeColorMap);
			textTheme.setSelected(descriptor.text.color.ref, descriptor.text.color.hex);
			textTheme.setDisabled(!canEdit);

			for (const [side, handles] of borderRows) {
				const state = descriptor.borders[side];
				handles.color.value = state.color.hex;
				handles.color.disabled = !canEdit;
				handles.width.value = String(state.width);
				handles.width.disabled = !canEdit;
				handles.dash.value = state.dash;
				handles.dash.disabled = !canEdit;
				handles.noFill.checked = state.noFill;
				handles.noFill.disabled = !canEdit;
			}
		},
	};
}

function makeToggleButton(doc: Document, label: string, onClick: () => void): HTMLButtonElement {
	const btn = doc.createElement('button');
	btn.type = 'button';
	btn.className = 'pptxv-tsef-toggle';
	btn.textContent = label;
	btn.addEventListener('click', onClick);
	return btn;
}
