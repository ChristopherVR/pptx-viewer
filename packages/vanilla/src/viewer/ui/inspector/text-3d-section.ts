import type { BevelPresetType, MaterialPresetType, Text3DStyle } from 'pptx-viewer-core';
import { BEVEL_PRESETS, MATERIAL_PRESETS } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import { makeNumberField } from '../controls';
import { makeCheckboxField, makeSelectField } from './controls-extra';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * EMU per typographic point. `Text3DStyle` stores bevel/extrusion sizes in EMU
 * (as OOXML does) while the panel edits points, so every field converts on the
 * way in and out. Hard-coded rather than imported because core does not export
 * its unit constants from the package root.
 */
const EMU_PER_PT = 12700;

function emuToPt(emu: number | undefined): number {
	return emu ? Math.round(emu / EMU_PER_PT) : 0;
}

function ptToEmu(pt: number): number {
	return Math.round(pt * EMU_PER_PT);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

/** One bevel block (top or bottom): preset type + width/height in points. */
function createBevelBlock(
	doc: Document,
	t: Translator,
	label: string,
	commit: (patch: Partial<Text3DStyle>) => void,
	keys: { type: keyof Text3DStyle; width: keyof Text3DStyle; height: keyof Text3DStyle },
) {
	const el = createEl(doc, 'div', 'pptxv-text3d-bevel');
	const caption = createEl(doc, 'span', 'pptxv-text3d-bevel-label');
	caption.textContent = label;
	const type = makeSelectField(doc, {
		label: `${label} ${t('pptx.text3d.bevelType')}`,
		options: BEVEL_PRESETS.map(({ value, label: text }) => ({ value, label: text })),
		onChange: (value) => commit({ [keys.type]: value as BevelPresetType } as Partial<Text3DStyle>),
	});
	const width = makeNumberField(doc, {
		label: `${label} ${t('pptx.text3d.bevelWidth')}`,
		min: 0,
		max: 50,
		onCommit: (value) =>
			commit({ [keys.width]: ptToEmu(clamp(value, 0, 50)) } as Partial<Text3DStyle>),
	});
	const height = makeNumberField(doc, {
		label: `${label} ${t('pptx.text3d.bevelHeight')}`,
		min: 0,
		max: 50,
		onCommit: (value) =>
			commit({ [keys.height]: ptToEmu(clamp(value, 0, 50)) } as Partial<Text3DStyle>),
	});
	el.append(caption, type.el, width.el, height.el);
	return {
		el,
		update(style: Text3DStyle | undefined, disabled: boolean) {
			type.setValue((style?.[keys.type] as BevelPresetType | undefined) ?? 'none');
			width.setValue(emuToPt(style?.[keys.width] as number | undefined));
			height.setValue(emuToPt(style?.[keys.height] as number | undefined));
			type.setDisabled(disabled);
			width.setDisabled(disabled);
			height.setDisabled(disabled);
		},
	};
}

/**
 * The 3D Text section (React's `Text3DProperties`): an extrusion toggle that
 * seeds a 6pt depth, extrusion depth + colour, the top/bottom bevel blocks and
 * the surface material. Everything below the toggle is hidden until extrusion
 * is on, matching PowerPoint (a bevel with no depth renders nothing).
 */
export function createText3DSection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
) {
	const el = section(t('pptx.text3d.title'));
	let current: Text3DStyle | undefined;

	const commit = (patch: Partial<Text3DStyle>): void => {
		current = { ...current, ...patch };
		handlers.setTextStyle({ text3d: current });
	};

	const enabled = makeCheckboxField(doc, {
		label: t('pptx.text3d.extrusion'),
		onChange: (on) => {
			if (on) {
				commit({ extrusionHeight: ptToEmu(6) });
			} else {
				current = undefined;
				handlers.setTextStyle({ text3d: undefined });
			}
		},
	});

	const options = createEl(doc, 'div', 'pptxv-text3d-options');
	const depth = makeNumberField(doc, {
		label: t('pptx.text3d.extrusionDepth'),
		min: 0,
		max: 100,
		onCommit: (value) => commit({ extrusionHeight: ptToEmu(clamp(value, 0, 100)) }),
	});
	const colorLabel = createEl(doc, 'label', 'pptxv-field pptxv-text3d-color');
	const colorCaption = createEl(doc, 'span', 'pptxv-field-label');
	colorCaption.textContent = t('pptx.text3d.extrusionColor');
	const color = doc.createElement('input');
	color.type = 'color';
	color.setAttribute('aria-label', t('pptx.text3d.extrusionColor'));
	color.addEventListener('change', () => {
		commit({ extrusionColor: color.value });
		handlers.pushRecentColor(color.value);
	});
	colorLabel.append(colorCaption, color);

	const top = createBevelBlock(doc, t, t('pptx.text3d.bevelTop'), commit, {
		type: 'bevelTopType',
		width: 'bevelTopWidth',
		height: 'bevelTopHeight',
	});
	const bottom = createBevelBlock(doc, t, t('pptx.text3d.bevelBottom'), commit, {
		type: 'bevelBottomType',
		width: 'bevelBottomWidth',
		height: 'bevelBottomHeight',
	});
	const material = makeSelectField(doc, {
		label: t('pptx.text3d.material'),
		options: MATERIAL_PRESETS.map(({ value, label }) => ({ value: value || '', label })),
		onChange: (value) =>
			commit({ presetMaterial: value ? (value as MaterialPresetType) : undefined }),
	});
	options.append(depth.el, colorLabel, top.el, bottom.el, material.el);
	el.append(enabled.el, options);

	return {
		el,
		update(state: InspectorState) {
			el.hidden = !state.canText;
			current = state.textStyle?.text3d;
			const hasExtrusion = Boolean(current?.extrusionHeight && current.extrusionHeight > 0);
			enabled.setValue(hasExtrusion);
			enabled.setDisabled(!state.canText);
			options.hidden = !hasExtrusion;
			depth.setValue(emuToPt(current?.extrusionHeight));
			depth.setDisabled(!hasExtrusion);
			color.value = /^#[0-9a-fA-F]{6}$/u.test(current?.extrusionColor ?? '')
				? (current?.extrusionColor as string)
				: '#888888';
			color.disabled = !hasExtrusion;
			top.update(current, !hasExtrusion);
			bottom.update(current, !hasExtrusion);
			material.setValue(current?.presetMaterial ?? '');
			material.setDisabled(!hasExtrusion);
		},
	};
}
