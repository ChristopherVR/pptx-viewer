import type { PptxThemeColorRef } from 'pptx-viewer-core';

import {
	OFFICE_COLOR_SWATCHES,
	RIBBON_SHAPE_SWATCHES,
	HOME_HIGHLIGHT_PRESETS,
	buildThemeColorSwatchGrid,
	findSelectedThemeSwatch,
	homeLabel,
	themeColorSwatchRows,
	themeSwatchCommit,
} from '../render';
import type { RibbonHomeColourModel, RibbonHomeColourSpec, RibbonHomeViewState } from '../render';

export type HomeColourPick = (hex: string, ref?: PptxThemeColorRef) => void;

interface Swatch {
	hex: string;
	label: string;
}

function standardSwatches(spec: RibbonHomeColourSpec): readonly Swatch[] {
	if (spec.swatches === 'office') {
		return OFFICE_COLOR_SWATCHES;
	}
	const hexes = spec.swatches === 'shape' ? RIBBON_SHAPE_SWATCHES : HOME_HIGHLIGHT_PRESETS;
	return hexes.map((hex) => ({
		hex,
		label: spec.swatchLabelPrefix ? `${spec.swatchLabelPrefix} ${hex}` : hex,
	}));
}

/** Paint the colour popover: theme palette, standard swatches, recent colours, custom colour. */
export function paintHomeColour(
	doc: Document,
	popup: HTMLElement,
	spec: RibbonHomeColourSpec,
	model: RibbonHomeColourModel | undefined,
	value: string | number | undefined,
	state: RibbonHomeViewState,
	pick: HomeColourPick,
): void {
	const current = typeof value === 'string' ? value.toLowerCase() : undefined;
	const heading = (key: string, fallback: string) => {
		const title = doc.createElement('div');
		title.className = 'heading';
		title.textContent = homeLabel(state, key, fallback);
		return title;
	};
	const swatch = (hex: string, label: string, selected: boolean, onPick: () => void) => {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'sw';
		button.dataset.pptxCompact = '';
		button.title = label;
		button.setAttribute('aria-label', label);
		button.setAttribute('aria-pressed', String(selected));
		button.style.backgroundColor = hex;
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', onPick);
		return button;
	};
	const sections: HTMLElement[] = [];

	const columns = spec.theme ? buildThemeColorSwatchGrid(model?.themeColors) : [];
	if (columns.length > 0) {
		const selected = findSelectedThemeSwatch(columns, model?.selectedRef, current);
		const grid = doc.createElement('div');
		grid.className = 'theme-grid';
		grid.style.gridTemplateColumns = `repeat(${columns.length}, auto)`;
		for (const row of themeColorSwatchRows(columns)) {
			for (const cell of row) {
				if (!cell) {
					grid.append(doc.createElement('span'));
					continue;
				}
				const button = swatch(cell.hex, cell.label, selected === cell, () => {
					const commit = themeSwatchCommit(cell);
					pick(commit.hex, commit.ref);
				});
				button.dataset.themeSwatch = cell.ref.scheme;
				grid.append(button);
			}
		}
		sections.push(heading('pptx.colorPicker.themeColors', 'Theme Colors'), grid);
	}

	const standard = doc.createElement('div');
	standard.className = 'std-grid';
	for (const { hex, label } of standardSwatches(spec)) {
		standard.append(swatch(hex, label, current === hex.toLowerCase(), () => pick(hex)));
	}
	sections.push(heading('pptx.colorPicker.standardColors', 'Standard Colors'), standard);

	if (model?.recent?.length) {
		const recent = doc.createElement('div');
		recent.className = 'recent';
		recent.dataset.testid = 'pptx-color-recent';
		const label = homeLabel(state, 'pptx.colorPicker.recentColors', 'Recent Colors');
		recent.setAttribute('aria-label', label);
		const caption = doc.createElement('span');
		caption.textContent = label;
		recent.append(caption);
		for (const hex of model.recent) {
			recent.append(swatch(hex, hex, current === hex.toLowerCase(), () => pick(hex)));
		}
		sections.push(recent);
	}

	if (spec.custom) {
		const input = doc.createElement('input');
		input.type = 'color';
		input.className = 'custom-input';
		input.tabIndex = -1;
		input.value = /^#[0-9a-f]{6}$/iu.test(current ?? '') ? (current as string) : '#000000';
		input.addEventListener('change', () => pick(input.value));
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'custom';
		button.textContent = homeLabel(state, 'pptx.ribbon.customColour', 'Custom colour...');
		button.addEventListener('mousedown', (event) => event.preventDefault());
		button.addEventListener('click', () => input.click());
		sections.push(button, input);
	}
	popup.replaceChildren(...sections);
}
