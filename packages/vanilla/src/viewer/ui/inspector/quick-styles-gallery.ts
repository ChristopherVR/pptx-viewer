import { SHAPE_QUICK_STYLES } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The Quick Styles gallery (React's `QuickStylesGallery`): PowerPoint's Shape
 * Styles grid, one click applying a whole fill/stroke/shadow preset to the
 * selection. Presets come from `pptx-viewer-shared` so every binding offers the
 * same swatches in the same order; the swatch itself previews the preset by
 * painting the button with the very style it applies.
 */
export function createQuickStylesGallery(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: Pick<InspectorHandlers, 'setShapeStyle'>,
) {
	const el = section(t('pptx.shape.quickStyles'));
	const grid = createEl(doc, 'div', 'pptxv-quick-styles');
	const buttons: HTMLButtonElement[] = [];

	for (const preset of SHAPE_QUICK_STYLES) {
		const button = createEl(doc, 'button', 'pptxv-quick-style');
		button.type = 'button';
		button.title = preset.name;
		button.setAttribute('aria-label', preset.name);
		button.style.background = preset.style.fillGradient || preset.style.fillColor || 'transparent';
		if (preset.style.strokeColor) {
			button.style.border = `${preset.style.strokeWidth ?? 1}px solid ${preset.style.strokeColor}`;
		}
		if (preset.style.shadowColor) {
			const x = preset.style.shadowOffsetX ?? 2;
			const y = preset.style.shadowOffsetY ?? 2;
			button.style.boxShadow = `${x}px ${y}px ${preset.style.shadowBlur ?? 4}px ${preset.style.shadowColor}`;
		}
		button.addEventListener('click', () => handlers.setShapeStyle(preset.style));
		grid.appendChild(button);
		buttons.push(button);
	}
	el.appendChild(grid);

	return {
		el,
		update(state: InspectorState) {
			// Same gate as the Fill & Stroke section: a quick style is a shape
			// style, so it is meaningless for a picture or a chart.
			el.hidden = !state.canShape;
			for (const button of buttons) {
				button.disabled = !state.canShape;
			}
		},
	};
}
