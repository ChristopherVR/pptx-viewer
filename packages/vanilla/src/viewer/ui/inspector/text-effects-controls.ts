import type { TextStyle } from 'pptx-viewer-core';
import { TEXT_WARP_PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

export interface TextEffectsControls {
	el: HTMLElement;
	update(state: InspectorState): void;
}

export function createTextEffectsControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): TextEffectsControls {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-text-effects';
	let state: InspectorState | null = null;
	const apply = (patch: Partial<TextStyle>): void =>
		handlers.setTextStyle(patch, state?.selectedTextRange);
	const applyBody = (patch: Partial<TextStyle>): void => handlers.setTextStyle(patch);
	const field = (labelText: string, input: HTMLElement): void => {
		const label = doc.createElement('label');
		label.textContent = labelText;
		label.appendChild(input);
		el.appendChild(label);
	};
	const number = (label: string, key: keyof TextStyle, min = 0, body = false): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'number';
		input.min = String(min);
		input.addEventListener('change', () =>
			(body ? applyBody : apply)({ [key]: Number(input.value) }),
		);
		field(label, input);
		return input;
	};
	const color = (label: string, key: keyof TextStyle): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'color';
		input.addEventListener('input', () => apply({ [key]: input.value }));
		field(label, input);
		return input;
	};
	const toggle = (label: string, key: keyof TextStyle): HTMLInputElement => {
		const input = doc.createElement('input');
		input.type = 'checkbox';
		input.addEventListener('change', () => apply({ [key]: input.checked }));
		field(label, input);
		return input;
	};
	const columns = number(t('pptx.textFormatting.columns'), 'columnCount', 1, true);
	columns.max = '6';
	const columnSpacing = number(t('pptx.textFormatting.columnSpacing'), 'columnSpacing', 0, true);
	const outlineColor = color(t('pptx.textEffects.outline'), 'textOutlineColor');
	const outlineWidth = number(t('pptx.textEffects.outlineWidth'), 'textOutlineWidth');
	const shadow = toggle(t('pptx.textEffects.shadow'), 'textShadowOpacity');
	const shadowColor = color(t('pptx.textEffects.shadowColor'), 'textShadowColor');
	const shadowBlur = number(t('pptx.textEffects.blur'), 'textShadowBlur');
	const glowColor = color(t('pptx.textEffects.glowColor'), 'textGlowColor');
	const glowRadius = number(t('pptx.textEffects.glow'), 'textGlowRadius');
	const reflection = toggle(t('pptx.textEffects.reflection'), 'textReflection');
	const strike = toggle(t('pptx.textFormatting.strikethrough'), 'strikethrough');
	const highlight = color(t('pptx.text.highlightColor'), 'highlightColor');
	const warp = doc.createElement('select');
	for (const preset of TEXT_WARP_PRESETS) {
		const option = doc.createElement('option');
		option.value = preset.value;
		option.textContent = preset.label;
		warp.appendChild(option);
	}
	warp.addEventListener('change', () =>
		applyBody({ textWarpPreset: warp.value === 'textNoShape' ? undefined : warp.value }),
	);
	field(t('pptx.textEffects.transform'), warp);
	const warpAdjust = number(t('pptx.textEffects.adjustment'), 'textWarpAdj', 0, true);
	const inputs = Array.from(
		el.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'),
	);

	return {
		el,
		update(next) {
			state = next;
			el.hidden = !next.canText;
			const style = next.textStyle ?? {};
			columns.value = String(style.columnCount ?? 1);
			columnSpacing.value = String(style.columnSpacing ?? 0);
			outlineColor.value = style.textOutlineColor ?? '#000000';
			outlineWidth.value = String(style.textOutlineWidth ?? 0);
			shadow.checked = Boolean(style.textShadowOpacity);
			shadowColor.value = style.textShadowColor ?? '#000000';
			shadowBlur.value = String(style.textShadowBlur ?? 4);
			glowColor.value = style.textGlowColor ?? '#ffff00';
			glowRadius.value = String(style.textGlowRadius ?? 0);
			reflection.checked = Boolean(style.textReflection);
			strike.checked = Boolean(style.strikethrough);
			highlight.value = style.highlightColor ?? '#ffff00';
			warp.value = style.textWarpPreset ?? 'textNoShape';
			warpAdjust.value = String(style.textWarpAdj ?? 50000);
			for (const input of inputs) {
				input.disabled = !next.canText;
			}
		},
	};
}
