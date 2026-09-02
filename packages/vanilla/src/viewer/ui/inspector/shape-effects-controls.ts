import type { ShapeStyle } from 'pptx-viewer-core';
import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { ColorControlHandle, NumberFieldHandle } from '../controls';
import { makeColorControl, makeNumberField } from '../controls';
import { createConnectorArrowControls } from './connector-arrow-controls';
import { makeCheckboxField, makeSelectField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

export interface ShapeEffectsControls {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The shape's outline preset and its effect stack (shadow, glow, soft edges,
 * reflection), plus the connector arrowhead pickers.
 *
 * Every row is built from the panel's own field factories rather than raw
 * `<label>`/`<input>` pairs. Written by hand they carried no class at all, so
 * the panel's stylesheet never reached them: the captions and their controls
 * became loose inline text that wrapped wherever the column ended ("Shadow
 * Color [swatch] Blur" on one line, its value on the next), and a second,
 * unstyled copy of the Quick Styles buttons rendered as the bare run
 * "AccentSubtleOutlineDark". The real gallery is its own section
 * (`quick-styles-gallery`), so that copy is gone.
 */
export function createShapeEffectsControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): ShapeEffectsControls {
	const el = createEl(doc, 'div', 'pptxv-inspector-shape-effects');

	const shapeType = makeSelectField<string>(doc, {
		label: t('pptx.shape.type'),
		options: SHAPE_PRESET_DEFS.map((preset) => ({
			value: preset.type as string,
			label: t(preset.i18nKey),
		})),
		onChange: (value) => handlers.setShapeType(value),
	});
	el.appendChild(shapeType.el);

	/**
	 * A colour swatch on its own labelled row, the same shape the Fill & Stroke
	 * rows use: the swatch control carries only a title, so the row supplies the
	 * visible caption.
	 */
	const colorRow = (label: string, key: keyof ShapeStyle, fallback: string): ColorControlHandle => {
		const row = createEl(doc, 'div', 'pptxv-inspector-row');
		const caption = createEl(doc, 'span', 'pptxv-inspector-row-label');
		caption.textContent = label;
		const control = makeColorControl(
			doc,
			{
				label,
				onInput: (value) => handlers.setShapeStyle({ [key]: value }),
				onCommit: handlers.pushRecentColor,
			},
			fallback,
		);
		row.append(caption, control.el);
		el.appendChild(row);
		return control;
	};

	const numberRow = (label: string, key: keyof ShapeStyle): NumberFieldHandle => {
		const field = makeNumberField(doc, {
			label,
			min: 0,
			onCommit: (value) => handlers.setShapeStyle({ [key]: value }),
		});
		el.appendChild(field.el);
		return field;
	};

	const shadowColor = colorRow(t('pptx.textEffects.shadowColor'), 'shadowColor', '#000000');
	const shadowBlur = numberRow(t('pptx.textEffects.blur'), 'shadowBlur');
	const shadowDistance = numberRow(t('pptx.shape.shadowDistance'), 'shadowDistance');
	const shadowRotateWithShape = makeCheckboxField(doc, {
		label: t('pptx.effects.rotateWithShape'),
		onChange: (checked) => handlers.setShapeStyle({ shadowRotateWithShape: checked }),
	});
	el.appendChild(shadowRotateWithShape.el);
	const glowColor = colorRow(t('pptx.textEffects.glowColor'), 'glowColor', '#ffff00');
	const glowRadius = numberRow(t('pptx.textEffects.glow'), 'glowRadius');
	const softEdge = numberRow(t('pptx.shape.softEdges'), 'softEdgeRadius');
	const reflection = makeCheckboxField(doc, {
		label: t('pptx.textEffects.reflection'),
		onChange: (checked) =>
			handlers.setShapeStyle({ reflectionStartOpacity: checked ? 0.5 : undefined }),
	});
	el.appendChild(reflection.el);

	// The six `a:headEnd`/`a:tailEnd` dropdowns are their own card; see
	// `connector-arrow-controls`.
	const arrows = createConnectorArrowControls(doc, t, handlers);
	el.appendChild(arrows.el);

	const fields = [
		shapeType,
		shadowColor,
		shadowBlur,
		shadowDistance,
		shadowRotateWithShape,
		glowColor,
		glowRadius,
		softEdge,
		reflection,
	];

	return {
		el,
		update(state) {
			const style = state.shapeStyle ?? {};
			shadowColor.setValue(style.shadowColor ?? '#000000');
			shadowBlur.setValue(style.shadowBlur ?? 0);
			shadowDistance.setValue(style.shadowDistance ?? 0);
			shadowRotateWithShape.setValue(style.shadowRotateWithShape ?? true);
			glowColor.setValue(style.glowColor ?? '#ffff00');
			glowRadius.setValue(style.glowRadius ?? 0);
			softEdge.setValue(style.softEdgeRadius ?? 0);
			reflection.setValue(Boolean(style.reflectionStartOpacity));
			shapeType.setValue(state.shapeType ?? 'rect');
			shapeType.el.hidden = !state.shapeType;
			arrows.update(state);
			for (const field of fields) {
				field.setDisabled(!state.canShape);
			}
		},
	};
}
