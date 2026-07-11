import type { SmartArtLayout } from 'pptx-viewer-core';
import { PRESETS as SMART_ART_INSERT_PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../../../i18n';
import { createEl } from '../../../../render';
import type { ButtonHandle } from '../../../controls';
import { makeButton } from '../../../controls';

export interface SmartArtGrid {
	el: HTMLElement;
	buttons: ButtonHandle[];
}

/**
 * Insert > SmartArt grid: one button per shared gallery preset
 * (`smart-art-presets.ts`, 34 layouts across 5 categories), flattened into a
 * single grid rather than React's category-tabbed dialog. Clicking a preset
 * inserts it immediately via the shared `buildSmartArtPresetData` factory
 * (wired in `editor-insert-structured.ts`).
 */
export function createSmartArtGrid(
	doc: Document,
	t: Translator,
	onSelect: (layout: SmartArtLayout, defaultItems: string[]) => void,
): SmartArtGrid {
	const el = createEl(doc, 'div', 'pptxv-smartart-grid');
	const buttons: ButtonHandle[] = [];
	for (const preset of SMART_ART_INSERT_PRESETS) {
		const btn = makeButton(doc, {
			label: t(preset.labelKey),
			icon: 'smart-art',
			onClick: () => onSelect(preset.layout, preset.defaultItems),
		});
		el.appendChild(btn.btn);
		buttons.push(btn);
	}
	return { el, buttons };
}
