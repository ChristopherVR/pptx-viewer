import type { ShapeStyle } from 'pptx-viewer-core';
import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createConnectorArrowControls } from './connector-arrow-controls';
import type { InspectorHandlers, InspectorState } from './types';

const QUICK_STYLES: Array<{ labelKey: string; patch: Partial<ShapeStyle> }> = [
	{
		labelKey: 'pptx.shape.quickStyleAccent',
		patch: { fillColor: '#4472c4', strokeColor: '#2f5597', strokeWidth: 1 },
	},
	{
		labelKey: 'pptx.shape.quickStyleSubtle',
		patch: { fillColor: '#f2f2f2', strokeColor: '#a6a6a6', strokeWidth: 1 },
	},
	{
		labelKey: 'pptx.shape.quickStyleOutline',
		patch: { fillColor: 'transparent', strokeColor: '#4472c4', strokeWidth: 2 },
	},
	{
		labelKey: 'pptx.shape.quickStyleDark',
		patch: { fillColor: '#262626', strokeColor: '#000000', strokeWidth: 1 },
	},
];

export interface ShapeEffectsControls {
	el: HTMLElement;
	update(state: InspectorState): void;
}

export function createShapeEffectsControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): ShapeEffectsControls {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-shape-effects';
	const gallery = doc.createElement('div');
	for (const style of QUICK_STYLES) {
		const button = doc.createElement('button');
		button.type = 'button';
		button.textContent = t(style.labelKey);
		button.addEventListener('click', () => handlers.setShapeStyle(style.patch));
		gallery.appendChild(button);
	}
	el.appendChild(gallery);
	const shapeType = doc.createElement('select');
	for (const preset of SHAPE_PRESET_DEFS) {
		const option = doc.createElement('option');
		option.value = preset.type;
		option.textContent = t(preset.i18nKey);
		shapeType.appendChild(option);
	}
	shapeType.addEventListener('change', () => handlers.setShapeType(shapeType.value));
	el.appendChild(shapeType);
	const field = (label: string, input: HTMLInputElement): void => {
		const wrapper = doc.createElement('label');
		wrapper.textContent = label;
		wrapper.appendChild(input);
		el.appendChild(wrapper);
	};
	const number = (label: string, key: keyof ShapeStyle): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'number';
		input.min = '0';
		input.addEventListener('change', () => handlers.setShapeStyle({ [key]: Number(input.value) }));
		field(label, input);
		return input;
	};
	const color = (label: string, key: keyof ShapeStyle): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'color';
		input.addEventListener('input', () => handlers.setShapeStyle({ [key]: input.value }));
		field(label, input);
		return input;
	};
	const shadowColor = color(t('pptx.textEffects.shadowColor'), 'shadowColor');
	const shadowBlur = number(t('pptx.textEffects.blur'), 'shadowBlur');
	const shadowDistance = number(t('pptx.shape.shadowDistance'), 'shadowDistance');
	const glowColor = color(t('pptx.textEffects.glowColor'), 'glowColor');
	const glowRadius = number(t('pptx.textEffects.glow'), 'glowRadius');
	const softEdge = number(t('pptx.shape.softEdges'), 'softEdgeRadius');
	const reflection = doc.createElement('input');
	reflection.type = 'checkbox';
	reflection.addEventListener('change', () =>
		handlers.setShapeStyle({ reflectionStartOpacity: reflection.checked ? 0.5 : undefined }),
	);
	field(t('pptx.textEffects.reflection'), reflection);
	// The six `a:headEnd`/`a:tailEnd` dropdowns are their own card; see
	// `connector-arrow-controls`.
	const arrows = createConnectorArrowControls(doc, t, handlers);
	el.appendChild(arrows.el);
	const inputs = [
		shapeType,
		shadowColor,
		shadowBlur,
		shadowDistance,
		glowColor,
		glowRadius,
		softEdge,
		reflection,
	];

	return {
		el,
		update(state) {
			const style = state.shapeStyle ?? {};
			shadowColor.value = style.shadowColor ?? '#000000';
			shadowBlur.value = String(style.shadowBlur ?? 0);
			shadowDistance.value = String(style.shadowDistance ?? 0);
			glowColor.value = style.glowColor ?? '#ffff00';
			glowRadius.value = String(style.glowRadius ?? 0);
			softEdge.value = String(style.softEdgeRadius ?? 0);
			reflection.checked = Boolean(style.reflectionStartOpacity);
			shapeType.value = state.shapeType ?? 'rect';
			shapeType.hidden = !state.shapeType;
			arrows.update(state);
			for (const input of inputs) {
				input.disabled = !state.canShape;
			}
			for (const button of gallery.querySelectorAll('button')) {
				button.disabled = !state.canShape;
			}
		},
	};
}
