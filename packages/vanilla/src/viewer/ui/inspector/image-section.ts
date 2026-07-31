import { ARTISTIC_EFFECTS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { NumberFieldHandle } from '../controls';
import { makeNumberField } from '../controls';
import type { RangeFieldHandle } from './controls-extra';
import { makeRangeField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

export interface ImageSection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The Image section: brightness/contrast/saturation adjustment sliders (CSS
 * `filter`-backed, see `pptx-viewer-shared/image-effects`) and a basic
 * numeric crop (four edge insets as a 0-90% fraction of that edge).
 */
export function createImageSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): ImageSection {
	const el = section(t('pptx.inspector.image'));
	const replace = doc.createElement('button');
	replace.type = 'button';
	replace.textContent = t('pptx.image.replaceImage');
	replace.addEventListener('click', handlers.replaceImage);
	const reset = doc.createElement('button');
	reset.type = 'button';
	reset.textContent = t('pptx.image.resetImage');
	reset.addEventListener('click', handlers.resetImage);
	el.append(replace, reset);

	const pct = (value: number): string => `${Math.round(value)}%`;

	const brightness = makeRangeField(doc, {
		label: t('pptx.imageAdjustments.brightness'),
		min: -100,
		max: 100,
		formatValue: pct,
		onCommit: handlers.setImageBrightness,
	});
	const contrast = makeRangeField(doc, {
		label: t('pptx.imageAdjustments.contrast'),
		min: -100,
		max: 100,
		formatValue: pct,
		onCommit: handlers.setImageContrast,
	});
	const saturation = makeRangeField(doc, {
		label: t('pptx.image.saturation'),
		min: -100,
		max: 100,
		formatValue: pct,
		onCommit: handlers.setImageSaturation,
	});
	el.append(brightness.el, contrast.el, saturation.el);

	const artisticLabel = doc.createElement('label');
	artisticLabel.textContent = t('pptx.image.artisticEffects');
	const artistic = doc.createElement('select');
	for (const [value, labelKey] of ARTISTIC_EFFECTS) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = t(labelKey);
		artistic.appendChild(option);
	}
	artistic.addEventListener('change', () =>
		handlers.setImageEffects({
			artisticEffect: artistic.value === 'none' ? undefined : artistic.value,
		}),
	);
	artisticLabel.appendChild(artistic);
	const transparency = makeRangeField(doc, {
		label: t('pptx.imageAdjustments.transparency'),
		min: 0,
		max: 100,
		formatValue: pct,
		onCommit: (value) => handlers.setImageEffects({ alphaModFix: 100 - value }),
	});
	const biLevel = makeRangeField(doc, {
		label: t('pptx.imageAdjustments.biLevelThreshold'),
		min: 0,
		max: 100,
		formatValue: pct,
		onCommit: (value) => handlers.setImageEffects({ biLevel: value }),
	});
	const duotone = createEl(doc, 'div', 'pptxv-inspector-grid');
	const colorInputs: Partial<Record<'color1' | 'color2', HTMLInputElement>> = {};
	const duoField = (labelText: string, key: 'color1' | 'color2'): HTMLInputElement => {
		const label = doc.createElement('label');
		label.textContent = labelText;
		const input = doc.createElement('input');
		input.type = 'color';
		input.addEventListener('input', () =>
			handlers.setImageEffects({
				duotone: {
					color1: key === 'color1' ? input.value : (colorInputs.color1?.value ?? '#000000'),
					color2: key === 'color2' ? input.value : (colorInputs.color2?.value ?? '#ffffff'),
				},
			}),
		);
		label.appendChild(input);
		duotone.appendChild(label);
		return input;
	};
	const color1 = duoField(t('pptx.image.duotoneDark'), 'color1');
	const color2 = duoField(t('pptx.image.duotoneLight'), 'color2');
	colorInputs.color1 = color1;
	colorInputs.color2 = color2;
	el.append(artisticLabel, transparency.el, biLevel.el, duotone);
	const wash = doc.createElement('input');
	wash.type = 'checkbox';
	const washColor = doc.createElement('input');
	washColor.type = 'color';
	let washOpacityValue = 40;
	const washOpacity = makeRangeField(doc, {
		label: t('pptx.image.washOpacity'),
		min: 0,
		max: 100,
		formatValue: pct,
		onCommit: (opacity) => {
			washOpacityValue = opacity;
			handlers.setImageEffects({ colorWash: { color: washColor.value, opacity } });
		},
	});
	wash.addEventListener('change', () =>
		handlers.setImageEffects({
			colorWash: wash.checked ? { color: washColor.value, opacity: washOpacityValue } : undefined,
		}),
	);
	washColor.addEventListener('input', () =>
		handlers.setImageEffects({
			colorWash: { color: washColor.value, opacity: washOpacityValue },
		}),
	);
	el.append(wash, washColor, washOpacity.el);

	const cropGrid = createEl(doc, 'div', 'pptxv-inspector-grid');
	el.appendChild(cropGrid);
	const cropField = (
		label: string,
		edge: 'left' | 'top' | 'right' | 'bottom',
	): NumberFieldHandle => {
		const field = makeNumberField(doc, {
			label,
			min: 0,
			max: 90,
			onCommit: (value) => handlers.setImageCrop(edge, value / 100),
		});
		cropGrid.appendChild(field.el);
		return field;
	};
	const cropLeft = cropField(t('pptx.image.cropLeft'), 'left');
	const cropTop = cropField(t('pptx.image.cropTop'), 'top');
	const cropRight = cropField(t('pptx.image.cropRight'), 'right');
	const cropBottom = cropField(t('pptx.image.cropBottom'), 'bottom');

	// Alt text (React's `ElementTransformControls`, Vue's `ImagePanel`,
	// Angular's `image-properties-panel`): the accessibility description screen
	// readers announce, and the field the Accessibility checker complains about
	// when it is empty. Committed on change, not per keystroke, so typing a
	// sentence is one history step.
	const altLabel = createEl(doc, 'label', 'pptxv-field pptxv-image-alt');
	const altCaption = createEl(doc, 'span', 'pptxv-field-label');
	altCaption.textContent = t('pptx.image.altText');
	const alt = doc.createElement('textarea');
	alt.rows = 2;
	alt.className = 'pptxv-image-alt-input';
	alt.placeholder = t('pptx.imageTransform.altTextPlaceholder');
	alt.setAttribute('aria-label', t('pptx.image.altText'));
	alt.addEventListener('keydown', (event) => event.stopPropagation());
	alt.addEventListener('change', () => handlers.setAltText(alt.value));
	altLabel.append(altCaption, alt);
	el.appendChild(altLabel);

	const sliders: RangeFieldHandle[] = [brightness, contrast, saturation];
	const cropFields = [cropLeft, cropTop, cropRight, cropBottom];

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.isImage;
			brightness.setValue(state.imageBrightness);
			contrast.setValue(state.imageContrast);
			saturation.setValue(state.imageSaturation);
			artistic.value = state.imageArtisticEffect;
			transparency.setValue(state.imageTransparency);
			biLevel.setValue(state.imageBiLevel);
			color1.value = state.imageDuotone1;
			color2.value = state.imageDuotone2;
			wash.checked = Boolean(state.imageColorWash);
			washColor.value = state.imageColorWash?.color ?? '#0066cc';
			washOpacity.setValue(state.imageColorWash?.opacity ?? 40);
			washOpacityValue = state.imageColorWash?.opacity ?? 40;
			if (doc.activeElement !== alt) {
				alt.value = state.altText;
			}
			alt.disabled = !state.isImage;
			cropLeft.setValue(state.cropLeft * 100);
			cropTop.setValue(state.cropTop * 100);
			cropRight.setValue(state.cropRight * 100);
			cropBottom.setValue(state.cropBottom * 100);
			for (const c of [...sliders, transparency, biLevel]) {
				c.setDisabled(!state.isImage);
			}
			artistic.disabled = !state.isImage;
			color1.disabled = !state.isImage;
			color2.disabled = !state.isImage;
			replace.disabled = !state.isImage;
			reset.disabled = !state.isImage;
			wash.disabled = !state.isImage;
			washColor.disabled = !state.isImage;
			washOpacity.setDisabled(!state.isImage);
			for (const c of cropFields) {
				c.setDisabled(!state.isImage);
			}
		},
	};
}
